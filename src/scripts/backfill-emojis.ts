/**
 * Overnight backfill for the emoji leaderboard: scans the full history of
 * every text channel and thread (active, archived and forum posts) and records typed emojis plus who reacted with what. Looking up
 * reactors costs one request per emoji per message, so a large server takes
 * hours; progress is saved per channel and the script resumes where it left
 * off if it's stopped or the phone reboots.
 *
 * Runs on the host next to the bot (same SQLite DB):
 *   npm run build:backfill   (on the Mac), copy dist/backfill-emojis.js, then
 *   node dist/backfill-emojis.js   (on the phone, from ~/rushmore)
 *
 * Env: TOKEN, GUILD_ID; optional EMOJI_BACKFILL_CHANNEL_IDS (comma list of
 * channel, thread, forum or category IDs; parents include their threads).
 */
import 'dotenv/config'

import { APIMessage, APIReaction, APIUser, REST, Routes } from 'discord.js'
import { getDb } from '../database/sqlite'
import {
    MessageInfo,
    recordReactions,
    recordTypedEmojis,
    toEmojiRef,
} from '../services/emoji.service'
import {
    channelName,
    listTextChannels,
    pageChannelHistory,
} from '../utils/discord-history'
import { parseIdList } from '../utils/id-list'

const rest = new REST().setToken(process.env.TOKEN ?? '')

type ChannelState = { before_id: string | null; scanned: number; done: number }

const loadState = (channelId: string): ChannelState =>
    (getDb()
        .prepare(
            'SELECT before_id, scanned, done FROM emoji_backfill WHERE channel_id = ?'
        )
        .get(channelId) as ChannelState | undefined) ?? {
        before_id: null,
        scanned: 0,
        done: 0,
    }

const saveState = (channelId: string, state: ChannelState): void => {
    getDb()
        .prepare(
            `INSERT INTO emoji_backfill (channel_id, before_id, scanned, done) VALUES (?, ?, ?, ?)
             ON CONFLICT (channel_id) DO UPDATE SET before_id = excluded.before_id,
                scanned = excluded.scanned, done = excluded.done`
        )
        .run(channelId, state.before_id, state.scanned, state.done)
}

/** Path segment the reactions endpoint expects for an emoji. */
const emojiParam = (r: APIReaction): string =>
    r.emoji.id
        ? `${r.emoji.name}:${r.emoji.id}`
        : encodeURIComponent(r.emoji.name ?? '')

/** Every non-bot user who reacted with this emoji (paged 100 at a time). */
const fetchReactors = async (
    channelId: string,
    messageId: string,
    reaction: APIReaction
): Promise<string[]> => {
    const ids: string[] = []
    let after: string | undefined
    for (;;) {
        const query = new URLSearchParams({ limit: '100' })
        if (after) query.set('after', after)
        const users = (await rest.get(
            Routes.channelMessageReaction(
                channelId,
                messageId,
                emojiParam(reaction)
            ),
            { query }
        )) as APIUser[]
        ids.push(...users.filter((u) => !u.bot).map((u) => u.id))
        const last = users[users.length - 1]
        if (!last || users.length < 100) return ids
        after = last.id
    }
}

const processMessage = async (m: APIMessage): Promise<void> => {
    const info: MessageInfo = {
        messageId: m.id,
        channelId: m.channel_id,
        authorId: m.author.id,
        createdAt: Date.parse(m.timestamp),
    }
    if (!m.author.bot) recordTypedEmojis(info, m.content)
    for (const reaction of m.reactions ?? []) {
        const emoji = toEmojiRef(reaction.emoji)
        if (!emoji) continue
        try {
            recordReactions(
                info,
                emoji,
                await fetchReactors(m.channel_id, m.id, reaction)
            )
        } catch (e) {
            console.log(
                `   reactors failed for ${m.id} ${emoji.name}: ${(e as Error).message}`
            )
        }
    }
}

async function main() {
    const guildId = process.env.GUILD_ID
    if (!guildId) throw new Error('Set GUILD_ID')
    const channels = await listTextChannels(
        rest,
        guildId,
        parseIdList(process.env.EMOJI_BACKFILL_CHANNEL_IDS)
    )
    console.log(`=== Emoji backfill over ${channels.length} channels ===`)

    for (const channel of channels) {
        const name = channelName(channel)
        const state = loadState(channel.id)
        if (state.done) {
            console.log(`#${name}: already done (${state.scanned} messages)`)
            continue
        }
        console.log(
            `#${name}: starting${state.before_id ? ` (resuming at ${state.scanned})` : ''}`
        )
        try {
            for await (const batch of pageChannelHistory(
                rest,
                channel.id,
                state.before_id ?? undefined
            )) {
                for (const m of batch) await processMessage(m)
                state.scanned += batch.length
                state.before_id = batch[batch.length - 1]?.id ?? state.before_id
                saveState(channel.id, state)
                if (state.scanned % 1000 < 100)
                    console.log(`   #${name}: ${state.scanned} messages`)
            }
            state.done = 1
            saveState(channel.id, state)
            console.log(`#${name}: done, ${state.scanned} messages`)
        } catch (e) {
            // Only skip channels the bot can't read. Anything else (network
            // drop, Discord outage) exits so a re-run resumes from the cursor.
            const status = (e as { status?: number }).status
            if (status !== 403 && status !== 404) throw e
            console.log(`#${name}: skipped (${(e as Error).message})`)
            state.done = 1
            saveState(channel.id, state)
        }
    }
    console.log('✅ Emoji backfill complete')
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
