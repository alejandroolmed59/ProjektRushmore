import { Message, PartialMessage, REST } from 'discord.js'
import { drainScanners, forgetMessages } from '../scanners/runner'
import {
    archiveMessages,
    ArchiveInput,
    fromApiMessage,
    fromDiscordMessage,
    newestMessagePerChannel,
    overwriteArchivedMessage,
} from '../services/message-archive.service'
import { pageChannelHistoryAfter } from '../utils/discord-history'

// Keeps the local message archive in sync with Discord. Best-effort: the
// archive must never break the bot.

const store = (messages: ArchiveInput[]): void => {
    if (archiveMessages(messages) > 0) void drainScanners()
}

export const archiveNewMessage = (message: Message): void => {
    if (!message.inGuild()) return
    try {
        store([fromDiscordMessage(message)])
    } catch (e) {
        console.log('[archive] failed to store message:', e)
    }
}

export const archiveEditedMessage = async (
    message: Message | PartialMessage
): Promise<void> => {
    try {
        const full = message.partial ? await message.fetch() : message
        if (!full.inGuild()) return
        store([fromDiscordMessage(full)])
    } catch (e) {
        console.log('[archive] failed to store edit:', e)
    }
}

/**
 * Archive the relocator's webhook copy of a message under the person who
 * wrote the original, so scanners count it for them. Discord reports the
 * webhook as the copy's author, and a bot's messages aren't counted. The
 * attribution lives only in the archive: a copy downloaded again into an
 * empty archive comes back under the webhook.
 */
export const archiveRelocatedCopy = (
    copy: Message,
    original: Message
): void => {
    if (!copy.inGuild()) return
    try {
        overwriteArchivedMessage({
            ...fromDiscordMessage(copy),
            authorId: original.author.id,
            authorBot: original.author.bot,
        })
        void drainScanners()
    } catch (e) {
        console.log('[archive] failed to store relocated copy:', e)
    }
}

export const archiveDeletedMessages = (ids: string[]): void => {
    try {
        forgetMessages(ids)
    } catch (e) {
        console.log('[archive] failed to delete messages:', e)
    }
}

/**
 * Download what was posted while the bot was down, in every channel the
 * archive already has messages from. Messages deleted meanwhile can't be
 * detected and stay in the archive.
 */
export const catchUpArchive = async (rest: REST): Promise<void> => {
    let added = 0
    for (const { channelId, messageId } of newestMessagePerChannel()) {
        try {
            for await (const batch of pageChannelHistoryAfter(
                rest,
                channelId,
                messageId
            )) {
                store(batch.map(fromApiMessage))
                added += batch.length
            }
        } catch (e) {
            // Deleted channel or lost access: nothing to catch up on.
            const status = (e as { status?: number }).status
            if (status !== 403 && status !== 404)
                console.log(`[archive] catch-up failed in ${channelId}:`, e)
        }
    }
    console.log(`[archive] caught up ${added} messages`)
}
