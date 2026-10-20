import {
    Message,
    EmbedBuilder,
    Colors,
    OmitPartialGroupDMChannel,
    PartialMessage,
} from 'discord.js'
import { createNewGambler, getMoney } from '../services/money.service'
import { maybeRelocateFootballMessage } from '../services/message-relocator.service'
import os from 'os'

export const newMessageInChannel = async (message: Message): Promise<void> => {
    if (message.author.bot) return // ignore bots

    // Relocate the watched user's football/soccer posts out of the channel.
    if (await maybeRelocateFootballMessage(message)) return

    if (message.content === '!ping') {
        message.reply(
            `Pong!, estoy corriendo en ${os.release()} , ${
                os.hostname
            }, memoria libre: ${os.freemem() / 1024 / 1024} MB`
        )
    }
    if (message.content === '!cajero') {
        try {
            const gamblerCreateResponse = createNewGambler(
                message.author.id,
                message.author.displayName
            )
            message.reply(gamblerCreateResponse.action)
        } catch (e) {
            message.reply(String(e))
        }
    }
}

type UpdatedMessage = OmitPartialGroupDMChannel<Message | PartialMessage>

/**
 * Re-run the football relocator on edits, otherwise the watched user can post
 * something harmless and edit football into it afterwards.
 */
export const messageEdited = async (
    oldMessage: UpdatedMessage,
    newMessage: UpdatedMessage
): Promise<void> => {
    // Embed unfurls and pins also fire updates; only re-check text changes.
    if (!oldMessage.partial && oldMessage.content === newMessage.content) return

    try {
        // Edits to messages sent before the bot started arrive partial.
        const message = newMessage.partial
            ? await newMessage.fetch()
            : newMessage
        if (message.author.bot) return
        await maybeRelocateFootballMessage(message)
    } catch (e) {
        console.log('[edits] failed to check edited message:', e)
    }
}
