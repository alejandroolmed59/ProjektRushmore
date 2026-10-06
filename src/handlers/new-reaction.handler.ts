import {
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    User,
} from 'discord.js'
import {
    maybeRelocateFootballByReaction,
    maybeRespondFatigueByReaction,
} from '../services/message-relocator.service'
import { trackReactionAdd } from './emoji.handler'

/**
 * Reactions on uncached messages arrive partial. Resolve the message once here
 * and hand it to every feature, instead of each one fetching it again.
 */
export const newReactionHandler = async (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): Promise<void> => {
    try {
        const message = reaction.message.partial
            ? await reaction.message.fetch()
            : reaction.message
        await trackReactionAdd(reaction, message, user)

        // The fetched message carries the full reaction (with its count),
        // which the classifier triggers need.
        const full = message.reactions.cache.get(
            reaction.emoji.id ?? reaction.emoji.name ?? ''
        )
        if (!full) return
        await Promise.all([
            maybeRelocateFootballByReaction(full, message),
            maybeRespondFatigueByReaction(full, message),
        ])
    } catch (e) {
        console.log('[reactions] failed to handle reaction:', e)
    }
}
