/**
 * One-time bootstrap — run locally BEFORE going live.
 *
 * Pages the watched user's real message history from a channel, sends it to
 * Gemini to EXTRACT the football keywords/phrases this specific person uses,
 * and writes them to data/learned-keywords.json. The live bot merges that file
 * into its detector at startup (see football-detector.service.ts), so detection
 * gets tuned to how this user actually talks instead of a hardcoded guess.
 *
 * Idempotent: if data/learned-keywords.json already exists it refuses to run
 * (so the expensive Gemini pass happens only once). Pass --force to re-run.
 *
 * Run with:  npm run extract-keywords          (or add --force to overwrite)
 *
 * Env:
 *   TOKEN                bot token
 *   GEMINI_API_KEY       Google AI Studio key (required for extraction)
 *   SHITPOST_USER_ID     user to analyze
 *   ANALYZE_CHANNEL_ID   channel to scan — MUST be a channel the user posts in
 *                        (NOT the relocation target, which starts empty)
 *   ANALYZE_MAX_MESSAGES how many messages to page back (default 1000)
 */
import 'dotenv/config'

import { Client, GatewayIntentBits, TextChannel } from 'discord.js'
import {
    keywordHasFootball,
    extractKeywordsFromHistory,
} from '../services/football-detector.service'
import {
    hasLearnedKeywords,
    saveLearnedKeywords,
    learnedKeywordsPath,
} from '../services/learned-keywords.service'

const force = process.argv.includes('--force')
const userId = process.env.SHITPOST_USER_ID
const channelId =
    process.env.ANALYZE_CHANNEL_ID ?? process.env.SHITPOST_TARGET_CHANNEL_ID
const maxMessages = Number(process.env.ANALYZE_MAX_MESSAGES ?? '1000')
const model = process.env.GEMINI_MODEL ?? ''

async function main() {
    console.log('=== Football keyword bootstrap ===')

    if (hasLearnedKeywords() && !force) {
        console.log(
            `↩︎  ${learnedKeywordsPath()} already exists — analysis has already run.\n` +
                '   Pass --force to re-run and overwrite it. Skipping.'
        )
        process.exit(0)
    }
    if (!userId || !channelId) {
        throw new Error(
            'Set SHITPOST_USER_ID and ANALYZE_CHANNEL_ID (or SHITPOST_TARGET_CHANNEL_ID)'
        )
    }
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required to extract keywords')
    }

    console.log(
        `Config: user=${userId} channel=${channelId} maxMessages=${maxMessages} model=${model}` +
            (force ? ' (force overwrite)' : '')
    )

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    })

    await client.login(process.env.TOKEN)
    console.log('✅ Logged in, fetching history...')

    const channel = await client.channels.fetch(channelId)
    if (!(channel instanceof TextChannel)) {
        throw new Error(`Channel ${channelId} is not a text channel`)
    }

    const collected: string[] = []
    let before: string | undefined = undefined
    let scanned = 0

    while (scanned < maxMessages) {
        const options: { limit: number; before?: string } = { limit: 100 }
        if (before) options.before = before
        const batch = await channel.messages.fetch(options)
        if (batch.size === 0) break

        for (const msg of batch.values()) {
            scanned++
            if (msg.author.id === userId && msg.content.trim().length > 0) {
                collected.push(msg.content)
            }
        }

        before = batch.last()?.id
        if (!before) break
    }

    console.log(
        `📥 Scanned ${scanned} messages, found ${collected.length} from the watched user.`
    )

    if (collected.length === 0) {
        throw new Error(
            'No messages from the watched user in this channel — check SHITPOST_USER_ID / ANALYZE_CHANNEL_ID.'
        )
    }

    const verdicts = collected.map(keywordHasFootball)
    const keywordYes = verdicts.filter((v) => v === 'yes').length
    const keywordMaybe = verdicts.filter((v) => v === 'maybe').length
    console.log(
        `   Built-in pre-check: ${keywordYes} 'yes', ${keywordMaybe} 'maybe'.`
    )

    console.log('🤖 Extracting keywords with Gemini...')
    const learned = await extractKeywordsFromHistory(collected, (done, total) =>
        console.log(`   ...analyzed ${done}/${total} messages`)
    )

    if (learned.failedBatches > 0) {
        console.log(
            `⚠️  ${learned.failedBatches}/${learned.totalBatches} batches failed.`
        )
    }
    // Don't write the "already ran" guard file if extraction wholesale failed —
    // that would block a clean re-run.
    if (learned.failedBatches === learned.totalBatches) {
        throw new Error(
            'All extraction batches failed (likely a transient Gemini outage). Nothing saved — re-run the command.'
        )
    }

    saveLearnedKeywords({
        generatedAt: new Date().toISOString(),
        model,
        messagesAnalyzed: collected.length,
        strong: learned.strong,
        ambiguous: learned.ambiguous,
    })

    console.log(
        `\n✅ Done. Wrote ${learned.strong.length} strong + ${learned.ambiguous.length} ambiguous learned keywords to:\n   ${learnedKeywordsPath()}`
    )
    if (learned.strong.length)
        console.log(`   strong:    ${learned.strong.join(', ')}`)
    if (learned.ambiguous.length)
        console.log(`   ambiguous: ${learned.ambiguous.join(', ')}`)
    console.log(
        '\nThe live bot will merge these on next startup. Re-run with --force to refresh.'
    )

    await client.destroy()
    process.exit(0)
}

main().catch((e) => {
    console.error('❌ Bootstrap failed:', e)
    process.exit(1)
})
