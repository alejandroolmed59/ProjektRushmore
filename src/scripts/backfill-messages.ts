/**
 * Downloads the server's full message history into the local archive (the
 * `messages` table): every text channel and thread, active, archived and
 * forum posts. Text only, 100 messages per request, so it's much faster than
 * the emoji backfill. Progress is saved per channel and the script resumes
 * where it left off if it's stopped or the phone reboots.
 *
 * It only downloads. The running bot notices the new rows within a minute and
 * feeds them to the scanners (src/scanners), so leave the bot running.
 *
 * Runs on the host next to the bot (same SQLite DB):
 *   npm run build:backfill-messages   (on the Mac), copy dist/backfill-messages.js, then
 *   node dist/backfill-messages.js    (on the phone, from ~/rushmore)
 *
 * Env: TOKEN, GUILD_ID; optional MESSAGE_BACKFILL_CHANNEL_IDS (comma list of
 * channel, thread, forum or category IDs; parents include their threads).
 */
import 'dotenv/config'

import { REST } from 'discord.js'
import { getDb } from '../database/sqlite'
import {
    archiveMessages,
    fromApiMessage,
} from '../services/message-archive.service'
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
            'SELECT before_id, scanned, done FROM message_backfill WHERE channel_id = ?'
        )
        .get(channelId) as ChannelState | undefined) ?? {
        before_id: null,
        scanned: 0,
        done: 0,
    }

const saveState = (channelId: string, state: ChannelState): void => {
    getDb()
        .prepare(
            `INSERT INTO message_backfill (channel_id, before_id, scanned, done) VALUES (?, ?, ?, ?)
             ON CONFLICT (channel_id) DO UPDATE SET before_id = excluded.before_id,
                scanned = excluded.scanned, done = excluded.done`
        )
        .run(channelId, state.before_id, state.scanned, state.done)
}

async function main() {
    const guildId = process.env.GUILD_ID
    if (!guildId) throw new Error('Set GUILD_ID')
    const channels = await listTextChannels(
        rest,
        guildId,
        parseIdList(process.env.MESSAGE_BACKFILL_CHANNEL_IDS)
    )
    console.log(`=== Message backfill over ${channels.length} channels ===`)
    const startedAt = Date.now()
    let total = 0

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
                archiveMessages(batch.map(fromApiMessage))
                state.scanned += batch.length
                state.before_id = batch[batch.length - 1]?.id ?? state.before_id
                saveState(channel.id, state)
                total += batch.length
                if (state.scanned % 5000 < 100) {
                    const perSecond = total / ((Date.now() - startedAt) / 1000)
                    console.log(
                        `   #${name}: ${state.scanned} messages (${perSecond.toFixed(0)} msg/s overall)`
                    )
                }
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
    const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1)
    console.log(
        `✅ Message backfill complete: ${total} messages in ${minutes} min`
    )
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
