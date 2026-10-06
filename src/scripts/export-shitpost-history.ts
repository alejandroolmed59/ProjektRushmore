/**
 * Export the watched user's full message history, with how many people reacted
 * to each message with the shitpost emoji. That reaction count is the label we
 * use to teach and evaluate the Jev shitpost detector.
 *
 * Uses the REST API only (no gateway login), so it can run while the live bot
 * is up without opening a second session.
 *
 * Run with:  npm run export-shitposts
 *
 * Env:
 *   TOKEN, GUILD_ID          bot token and server to scan
 *   SHITPOST_USER_ID         user whose messages to export
 *   SHITPOST_TRIGGER_EMOJI   custom emoji ID that marks a shitpost
 *   SHITPOST_EXPORT_CHANNEL_IDS  optional comma list; default all text channels
 *   SHITPOST_EXPORT_SINCE    optional date (e.g. 2026-01-01); stop paging a
 *                            channel past it. Reactions with the emoji only
 *                            exist since early 2026, so older history is unlabeled.
 *
 * Output: data/shitpost-history.jsonl (gitignored — real messages stay local).
 */
import 'dotenv/config'

import fs from 'fs'
import path from 'path'
import { APIChannel, APIMessage, REST } from 'discord.js'
import {
    channelName,
    listTextChannels,
    pageChannelHistory,
    parseIdList,
} from '../utils/discord-history'

const guildId = process.env.GUILD_ID
const userId = process.env.SHITPOST_USER_ID
const emojiId = process.env.SHITPOST_TRIGGER_EMOJI
const since = Date.parse(process.env.SHITPOST_EXPORT_SINCE ?? '') || 0
const OUTPUT = path.join(process.cwd(), 'data', 'shitpost-history.jsonl')

export type ExportedMessage = {
    id: string
    channelId: string
    createdAt: string
    content: string
    attachments: number
    /** People (not counting Rushmore) who reacted with the shitpost emoji. */
    shitpostReactions: number
    totalReactions: number
}

const rest = new REST().setToken(process.env.TOKEN ?? '')

const toExported = (m: APIMessage): ExportedMessage => {
    const reactions = m.reactions ?? []
    const shitpost = reactions.find((r) => r.emoji.id === emojiId)
    // count includes the bot's own reaction when `me` is set; drop it so the
    // detector never learns from its own output.
    const withoutBot = (r: { count: number; me: boolean }) =>
        r.count - (r.me ? 1 : 0)
    return {
        id: m.id,
        channelId: m.channel_id,
        createdAt: m.timestamp,
        content: m.content,
        attachments: m.attachments.length,
        shitpostReactions: shitpost ? withoutBot(shitpost) : 0,
        totalReactions: reactions.reduce((sum, r) => sum + withoutBot(r), 0),
    }
}

/** Page a channel's whole history, newest first, keeping the user's messages. */
const exportChannel = async (
    channel: APIChannel,
    out: fs.WriteStream
): Promise<{ scanned: number; kept: number }> => {
    let scanned = 0
    let kept = 0
    for await (const batch of pageChannelHistory(rest, channel.id)) {
        for (const m of batch) {
            if (Date.parse(m.timestamp) < since) return { scanned, kept }
            scanned++
            if (m.author.id !== userId) continue
            out.write(JSON.stringify(toExported(m)) + '\n')
            kept++
        }
        if (scanned % 5000 < 100)
            console.log(`   …${scanned} scanned, ${kept} from user`)
    }
    return { scanned, kept }
}

async function main() {
    if (!guildId || !userId || !emojiId) {
        throw new Error(
            'Set GUILD_ID, SHITPOST_USER_ID and SHITPOST_TRIGGER_EMOJI'
        )
    }
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
    const out = fs.createWriteStream(OUTPUT)

    const channels = await listTextChannels(
        rest,
        guildId,
        parseIdList(process.env.SHITPOST_EXPORT_CHANNEL_IDS)
    )
    console.log(
        `=== Exporting user ${userId} from ${channels.length} channels ===`
    )

    let totalScanned = 0
    let totalKept = 0
    for (const channel of channels) {
        const name = channelName(channel)
        try {
            const { scanned, kept } = await exportChannel(channel, out)
            totalScanned += scanned
            totalKept += kept
            console.log(`#${name}: ${scanned} scanned, ${kept} from user`)
        } catch (e) {
            // Usually 403: the bot can't read that channel. Skip it.
            console.log(`#${name}: skipped (${(e as Error).message})`)
        }
    }
    await new Promise<void>((resolve) => out.end(resolve))
    console.log(
        `\n✅ ${totalKept} messages from user (of ${totalScanned} scanned) → ${OUTPUT}`
    )
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
