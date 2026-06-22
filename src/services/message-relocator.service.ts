import {
    Message,
    MessageReaction,
    PartialMessageReaction,
    Webhook,
    WebhookType,
    TextChannel,
    NewsChannel,
} from 'discord.js'
import {
    isFootballMessage,
    geminiIsFootball,
} from './football-detector.service'
import { geminiIsWorkRelated } from './work-detector.service'

const WEBHOOK_NAME = 'shitpost-relocator'

const parseUserIds = (raw: string | undefined): string[] =>
    (raw ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)

// Watched user for the football relocator.
export const getWatchedUserIds = (): string[] =>
    parseUserIds(process.env.SHITPOST_USER_ID)

// Watched user for the work/fatigue detector.
export const getFatigueUserIds = (): string[] =>
    parseUserIds(process.env.FATIGUE_USER_ID)

const isWatchedUser = (userId: string, watchedUserIds: string[]): boolean =>
    watchedUserIds.includes(userId)

type WebhookCapableChannel = TextChannel | NewsChannel

const canHostWebhook = (channel: unknown): channel is WebhookCapableChannel =>
    channel instanceof TextChannel || channel instanceof NewsChannel

/**
 * Reuse our relocator webhook on the channel if it exists, otherwise create it.
 */
const getOrCreateWebhook = async (
    channel: WebhookCapableChannel
): Promise<Webhook> => {
    const webhooks = await channel.fetchWebhooks()
    const existing = webhooks.find(
        (wh) =>
            wh.name === WEBHOOK_NAME &&
            wh.type === WebhookType.Incoming &&
            wh.token != null
    )
    if (existing) return existing
    return channel.createWebhook({ name: WEBHOOK_NAME })
}

/**
 * "Move" a message: repost its content in the target channel through a webhook
 * that mimics the author's name + avatar, then delete the original.
 *
 * Best-effort: on any failure we log and leave the original message in place
 * rather than risk deleting without a successful repost.
 */
export const relocateMessage = async (
    message: Message,
    targetChannelId: string
): Promise<void> => {
    try {
        const target = await message.client.channels.fetch(targetChannelId)
        if (!canHostWebhook(target)) {
            console.log(
                `[relocator] target channel ${targetChannelId} is not a webhook-capable text channel; skipping`
            )
            return
        }

        const webhook = await getOrCreateWebhook(target)

        // Forward attachment URLs inline (simplest); Discord CDN links from the
        // original message stay valid after deletion for already-uploaded files.
        const attachmentUrls = message.attachments.map((a) => a.url)
        const body = [message.content, ...attachmentUrls]
            .filter((part) => part.length > 0)
            .join('\n')

        if (body.length === 0) return

        await webhook.send({
            content: body,
            username: message.member?.displayName ?? message.author.username,
            avatarURL: message.author.displayAvatarURL(),
            allowedMentions: { parse: [] }, // don't re-ping anyone on the copy
        })

        await message.delete()
    } catch (e) {
        console.log(
            '[relocator] failed to relocate message, leaving original:',
            e
        )
    }
}

/**
 * Shared guard for both relocator entry points: the message is from the watched
 * user, isn't already in the target channel, and has text to forward. Kept in
 * one place so the two callers can't drift apart.
 */
const isRelocatableMessage = (
    message: Message,
    watchedUserIds: string[],
    targetChannelId: string
): boolean =>
    isWatchedUser(message.author.id, watchedUserIds) &&
    message.channelId !== targetChannelId &&
    message.content.trim().length > 0

/**
 * Feature entry point for the message handler: if this message is a football
 * post from the watched user (and the feature is configured), relocate it.
 * Returns true when the message was handled so the caller can stop processing.
 *
 * Config lives here rather than in the handler so the hot path stays thin and
 * the whole "shitpost relocator" feature is self-contained.
 */
export const maybeRelocateFootballMessage = async (
    message: Message
): Promise<boolean> => {
    const watchedUserIds = getWatchedUserIds()
    const targetChannelId = process.env.SHITPOST_TARGET_CHANNEL_ID
    if (
        watchedUserIds.length === 0 ||
        !targetChannelId ||
        !isRelocatableMessage(message, watchedUserIds, targetChannelId)
    ) {
        return false
    }

    if (!(await isFootballMessage(message.content))) return false

    await relocateMessage(message, targetChannelId)
    return true
}

/**
 * If the watched user posts about work/fatigue and someone reacts with the
 * configured trigger emoji, answer by reacting with the configured fatigue emoji.
 */
export const maybeRespondFatigueByReaction = async (
    reactionInput: MessageReaction | PartialMessageReaction
): Promise<boolean> => {
    const watchedUserIds = getFatigueUserIds()
    const triggerEmoji = process.env.JB_FATIGUE_EMOJI
    const responseEmoji = process.env.JB_FATIGUE_EMOJI
    if (!watchedUserIds.length || !triggerEmoji || !responseEmoji) return false

    if (
        reactionInput.emoji.id !== triggerEmoji &&
        reactionInput.emoji.name !== triggerEmoji
    ) {
        return false
    }

    try {
        const reaction = reactionInput.partial
            ? await reactionInput.fetch()
            : reactionInput
        const message = reaction.message.partial
            ? await reaction.message.fetch()
            : reaction.message

        if (!isWatchedUser(message.author.id, watchedUserIds)) {
            return false
        }

        // Only the first 2 reactions triggers; later reactors on the same
        // message see count different than 2 and are ignored, so we answer at most once.
        if (reaction.count !== 2) return false

        if (!(await geminiIsWorkRelated(message.content))) return false

        await message.reply(`Si Justin <:custom_name:${responseEmoji}>`)
        return true
    } catch (e) {
        console.log('[relocator] fatigue reaction failed:', e)
        return false
    }
}

/**
 * Manual fallback for posts the auto-detector missed: when 2 users react with
 * the configured trigger emoji to one of the watched user's messages, force the
 * Gemini analysis (skipping the keyword shortcut, which already let this message
 * through on create) and relocate it if Gemini agrees it's football.
 *
 * Returns true when the message was relocated. Best-effort: any failure is
 * logged and leaves the original in place.
 */
export const maybeRelocateFootballByReaction = async (
    reactionInput: MessageReaction | PartialMessageReaction
): Promise<boolean> => {
    const watchedUserIds = getWatchedUserIds()
    const targetChannelId = process.env.SHITPOST_TARGET_CHANNEL_ID
    const triggerEmoji = process.env.SHITPOST_TRIGGER_EMOJI // custom emoji ID
    if (!watchedUserIds.length || !targetChannelId || !triggerEmoji)
        return false

    // Cheapest check first, against the partial: the emoji is always populated,
    // so we reject the overwhelming majority of reactions (wrong emoji) before
    // paying for any network fetch. Match by ID (custom emoji) or name (unicode).
    if (
        reactionInput.emoji.id !== triggerEmoji &&
        reactionInput.emoji.name !== triggerEmoji
    )
        return false

    try {
        // Resolve partials (reactions on uncached/old messages arrive partial).
        const reaction = reactionInput.partial
            ? await reactionInput.fetch()
            : reactionInput

        if (reaction.count < 2) return false
        console.log('Reaccion es mayor a 2')
        const message = reaction.message.partial
            ? await reaction.message.fetch()
            : reaction.message

        if (!isRelocatableMessage(message, watchedUserIds, targetChannelId))
            return false

        // Force the LLM — the keyword path already let this through on create.
        if (!(await geminiIsFootball(message.content))) return false
        console.log('mensaje a relocar')
        await relocateMessage(message, targetChannelId)
        return true
    } catch (e) {
        console.log('[relocator] reaction trigger failed:', e)
        return false
    }
}
