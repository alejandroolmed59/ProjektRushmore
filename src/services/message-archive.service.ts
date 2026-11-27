import { APIMessage, Message } from 'discord.js'
import { getDb, transaction } from '../database/sqlite'

/** One row of the local message archive (the `messages` table). */
export type ArchivedMessage = {
    seq: number
    id: string
    channelId: string
    authorId: string
    authorBot: boolean
    content: string
    replyToId: string | null
    attachmentCount: number
    createdAt: number
    editedAt: number | null
}

export type ArchiveInput = Omit<ArchivedMessage, 'seq'>

export const fromDiscordMessage = (m: Message<true>): ArchiveInput => ({
    id: m.id,
    channelId: m.channelId,
    authorId: m.author.id,
    authorBot: m.author.bot,
    content: m.content,
    replyToId: m.reference?.messageId ?? null,
    attachmentCount: m.attachments.size,
    createdAt: m.createdTimestamp,
    editedAt: m.editedTimestamp,
})

export const fromApiMessage = (m: APIMessage): ArchiveInput => ({
    id: m.id,
    channelId: m.channel_id,
    authorId: m.author.id,
    authorBot: !!m.author.bot,
    content: m.content,
    replyToId: m.message_reference?.message_id ?? null,
    attachmentCount: m.attachments.length,
    createdAt: Date.parse(m.timestamp),
    editedAt: m.edited_timestamp ? Date.parse(m.edited_timestamp) : null,
})

const insertMessage = (m: ArchiveInput): void => {
    // INSERT OR REPLACE (rather than UPDATE) removes the old row first, so
    // the new one gets a new seq and the scanners pick up the edit.
    getDb()
        .prepare(
            `INSERT OR REPLACE INTO messages (id, channel_id, author_id, author_bot,
                content, reply_to_id, attachment_count, created_at, edited_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            m.id,
            m.channelId,
            m.authorId,
            m.authorBot ? 1 : 0,
            m.content,
            m.replyToId,
            m.attachmentCount,
            m.createdAt,
            m.editedAt
        )
}

/**
 * Insert or rewrite one message. A message already stored with the same text
 * and edit time is left alone, so re-downloading history doesn't make the
 * scanners read it again. Returns whether anything was written.
 */
const writeMessage = (m: ArchiveInput): boolean => {
    const db = getDb()
    const existing = db
        .prepare('SELECT content, edited_at FROM messages WHERE id = ?')
        .get(m.id) as { content: string; edited_at: number | null } | undefined
    if (
        existing &&
        existing.content === m.content &&
        existing.edited_at === m.editedAt
    )
        return false
    insertMessage(m)
    return true
}

/** Store messages; returns how many were new or changed. */
export const archiveMessages = (messages: ArchiveInput[]): number =>
    transaction(() => messages.filter(writeMessage).length)

/**
 * Store a message even if the archive already has it with the same text, so
 * the scanners read it again. For a copy whose author differs from the one
 * Discord reports: a later write of the same text leaves the row alone, so
 * the author given here stays.
 */
export const overwriteArchivedMessage = (message: ArchiveInput): void => {
    insertMessage(message)
}

/**
 * Whether the row a scanner was handed is still in the archive. False once
 * the message was deleted, or rewritten by an edit (which gets a new seq).
 */
export const isArchivedSeq = (seq: number): boolean =>
    getDb().prepare('SELECT 1 FROM messages WHERE seq = ?').get(seq) !==
    undefined

export const deleteArchivedMessages = (ids: string[]): void => {
    getDb()
        .prepare(
            'DELETE FROM messages WHERE id IN (SELECT value FROM json_each(?))'
        )
        .run(JSON.stringify(ids))
}

type MessageRow = {
    seq: number
    id: string
    channel_id: string
    author_id: string
    author_bot: number
    content: string
    reply_to_id: string | null
    attachment_count: number
    created_at: number
    edited_at: number | null
}

const toArchived = (r: MessageRow): ArchivedMessage => ({
    seq: r.seq,
    id: r.id,
    channelId: r.channel_id,
    authorId: r.author_id,
    authorBot: r.author_bot === 1,
    content: r.content,
    replyToId: r.reply_to_id,
    attachmentCount: r.attachment_count,
    createdAt: r.created_at,
    editedAt: r.edited_at,
})

/** The next `limit` messages written after `seq`, oldest write first. */
export const messagesAfterSeq = (
    seq: number,
    limit: number
): ArchivedMessage[] =>
    (
        getDb()
            .prepare(
                'SELECT * FROM messages WHERE seq > ? ORDER BY seq LIMIT ?'
            )
            .all(seq, limit) as MessageRow[]
    ).map(toArchived)

export const countMessagesAfterSeq = (seq: number): number =>
    (
        getDb()
            .prepare('SELECT COUNT(*) AS n FROM messages WHERE seq > ?')
            .get(seq) as { n: number }
    ).n

/** Channels with at least one archived message, and the newest one's ID. */
export const newestMessagePerChannel = (): {
    channelId: string
    messageId: string
}[] =>
    (
        getDb()
            .prepare(
                `SELECT channel_id, id FROM (
                    SELECT channel_id, id, ROW_NUMBER() OVER (
                        PARTITION BY channel_id ORDER BY created_at DESC
                    ) AS rn FROM messages
                 ) WHERE rn = 1`
            )
            .all() as { channel_id: string; id: string }[]
    ).map((r) => ({ channelId: r.channel_id, messageId: r.id }))
