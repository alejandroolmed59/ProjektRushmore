import { getDb, transaction } from '../database/sqlite'

export type EmojiRef = {
    /** Custom emoji ID, or the unicode emoji without variation selectors. */
    key: string
    name: string
    animated: boolean
}

const CUSTOM_EMOJI = /<(a?):(\w{2,32}):(\d{17,20})>/g
// Flags, or a pictograph with optional skin tone / VS16, joined by ZWJ.
const UNICODE_EMOJI =
    /\p{RI}\p{RI}|\p{Extended_Pictographic}(?:️|\p{EMod})?(?:‍\p{Extended_Pictographic}(?:️|\p{EMod})?)*/gu

/** Discord sends unicode reactions with or without U+FE0F; key them the same. */
export const unicodeKey = (emoji: string): string => emoji.replace(/️/g, '')

/** Every emoji typed in a message, with how many times each appears. */
export const extractEmojis = (
    content: string
): { emoji: EmojiRef; count: number }[] => {
    const found = new Map<string, { emoji: EmojiRef; count: number }>()
    const add = (emoji: EmojiRef) => {
        const entry = found.get(emoji.key)
        if (entry) entry.count++
        else found.set(emoji.key, { emoji, count: 1 })
    }
    for (const [, animated, name, id] of content.matchAll(CUSTOM_EMOJI))
        add({ key: id!, name: name!, animated: animated === 'a' })
    // Strip custom emoji first so their names can't match as unicode.
    for (const [match] of content
        .replace(CUSTOM_EMOJI, ' ')
        .matchAll(UNICODE_EMOJI))
        add({ key: unicodeKey(match), name: match, animated: false })
    return [...found.values()]
}

/** How to show an emoji in a Discord message. */
export const renderEmoji = (e: {
    emoji_key: string
    emoji_name: string
    animated: number
}): string =>
    /^\d+$/.test(e.emoji_key)
        ? `<${e.animated ? 'a' : ''}:${e.emoji_name}:${e.emoji_key}>`
        : e.emoji_name

// ---------- recording ----------

export type MessageInfo = {
    messageId: string
    channelId: string
    authorId: string
    createdAt: number
}

/** Record the emojis typed in a message (replaces any earlier record of it). */
export const recordTypedEmojis = (
    message: MessageInfo,
    content: string
): void => {
    const emojis = extractEmojis(content)
    if (emojis.length === 0) return
    const insert = getDb().prepare(
        `INSERT OR REPLACE INTO emoji_uses (message_id, channel_id, user_id, target_user_id,
            emoji_key, emoji_name, animated, kind, count, created_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 'message', ?, ?)`
    )
    transaction(() => {
        for (const { emoji, count } of emojis)
            insert.run(
                message.messageId,
                message.channelId,
                message.authorId,
                emoji.key,
                emoji.name,
                emoji.animated ? 1 : 0,
                count,
                message.createdAt
            )
    })
}

/** Record that each of `reactorIds` reacted to `message` with `emoji`. */
export const recordReactions = (
    message: MessageInfo,
    emoji: EmojiRef,
    reactorIds: string[],
    reactedAt: number = message.createdAt
): void => {
    if (reactorIds.length === 0) return
    const insert = getDb().prepare(
        `INSERT OR IGNORE INTO emoji_uses (message_id, channel_id, user_id, target_user_id,
            emoji_key, emoji_name, animated, kind, count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'reaction', 1, ?)`
    )
    transaction(() => {
        for (const reactorId of reactorIds)
            insert.run(
                message.messageId,
                message.channelId,
                reactorId,
                message.authorId,
                emoji.key,
                emoji.name,
                emoji.animated ? 1 : 0,
                reactedAt
            )
    })
}

export const removeReaction = (
    messageId: string,
    reactorId: string,
    emojiKey: string
): void => {
    getDb()
        .prepare(
            `DELETE FROM emoji_uses WHERE message_id = ? AND user_id = ? AND emoji_key = ? AND kind = 'reaction'`
        )
        .run(messageId, reactorId, emojiKey)
}

// ---------- leaderboards ----------

export type EmojiTotal = {
    emoji_key: string
    emoji_name: string
    animated: number
    total: number
}

export type ServerTopEmoji = EmojiTotal & {
    top_user_id: string
    top_user_total: number
}

/** Server-wide most used emojis (typed + reactions), each with its biggest fan. */
export const serverTopEmojis = (limit = 10): ServerTopEmoji[] =>
    getDb()
        .prepare(
            `WITH per_user AS (
                SELECT emoji_key, user_id, SUM(count) AS total FROM emoji_uses
                GROUP BY emoji_key, user_id
            ), ranked AS (
                SELECT emoji_key, user_id, total,
                    ROW_NUMBER() OVER (PARTITION BY emoji_key ORDER BY total DESC) AS rn
                FROM per_user
            )
            SELECT e.emoji_key, MAX(e.emoji_name) AS emoji_name, MAX(e.animated) AS animated,
                SUM(e.count) AS total, r.user_id AS top_user_id, r.total AS top_user_total
            FROM emoji_uses e JOIN ranked r ON r.emoji_key = e.emoji_key AND r.rn = 1
            GROUP BY e.emoji_key ORDER BY total DESC LIMIT ?`
        )
        .all(limit) as ServerTopEmoji[]

/** A user's most used emojis (what they type plus how they react). */
export const userTopEmojis = (userId: string, limit = 10): EmojiTotal[] =>
    getDb()
        .prepare(
            `SELECT emoji_key, MAX(emoji_name) AS emoji_name, MAX(animated) AS animated,
                SUM(count) AS total
             FROM emoji_uses WHERE user_id = ?
             GROUP BY emoji_key ORDER BY total DESC LIMIT ?`
        )
        .all(userId, limit) as EmojiTotal[]

/** Reactions other people most often put on this user's messages. */
export const userTopReceived = (userId: string, limit = 5): EmojiTotal[] =>
    getDb()
        .prepare(
            `SELECT emoji_key, MAX(emoji_name) AS emoji_name, MAX(animated) AS animated,
                COUNT(*) AS total
             FROM emoji_uses
             WHERE kind = 'reaction' AND target_user_id = ? AND user_id != target_user_id
             GROUP BY emoji_key ORDER BY total DESC LIMIT ?`
        )
        .all(userId, limit) as EmojiTotal[]

export const emojiStatsSince = (): { total: number; since: number | null } =>
    getDb()
        .prepare(
            'SELECT COALESCE(SUM(count), 0) AS total, MIN(created_at) AS since FROM emoji_uses'
        )
        .get() as { total: number; since: number | null }
