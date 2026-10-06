/**
 * "Train" the Jev shitpost detector from the exported history.
 *
 * Jev can't be fine-tuned, so we teach it in-context: real examples of this
 * user's shitposts (messages the server reacted to with the shitpost emoji) and
 * normal messages go into the question's yes/no criteria. To keep the score
 * honest, examples come from one part of the history and accuracy is measured
 * on a separate part Jev never saw.
 *
 * Run with:  npm run train-shitposts   (after npm run export-shitposts)
 *
 * Env (all optional):
 *   SHITPOST_MIN_REACTIONS  reactions needed to count as a shitpost (default 1)
 *   SHITPOST_EXAMPLES       examples per side in the question (default 40)
 *   SHITPOST_TEST_SIZE      test messages per side (default 150)
 *
 * Output: data/shitpost-examples.json, loaded by the live detector
 * (gitignored — it contains real messages).
 */
import 'dotenv/config'

import fs from 'fs'
import path from 'path'
import type { ExportedMessage } from './export-shitpost-history'
import {
    buildShitpostQuestion,
    ShitpostModel,
    SHITPOST_MODEL_PATH,
} from '../services/shitpost-detector.service'
import { getTypeSafeClient } from '../components/typesafeClient'

const HISTORY = path.join(process.cwd(), 'data', 'shitpost-history.jsonl')
const minReactions = Number(process.env.SHITPOST_MIN_REACTIONS ?? '1')
const examplesPerSide = Number(process.env.SHITPOST_EXAMPLES ?? '40')
const testPerSide = Number(process.env.SHITPOST_TEST_SIZE ?? '150')
const CONCURRENCY = 5
const MAX_EXAMPLE_CHARS = 300
// Recent messages may not have collected reactions yet, so they can't be
// trusted as "not a shitpost".
const SETTLE_MS = 3 * 24 * 60 * 60 * 1000
// The bot may react wrongly to at most this share of normal messages.
const MAX_FALSE_POSITIVE_RATE = 0.05
// Minimum share of shitposts caught for the detector to be worth enabling.
const MIN_USEFUL_RECALL = 0.3
const THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

// Seeded shuffle so re-runs pick the same split and results are comparable.
const shuffle = <T>(items: T[], seed = 42): T[] => {
    const a = [...items]
    let s = seed
    const rand = () => (s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[a[i], a[j]] = [a[j]!, a[i]!]
    }
    return a
}

const isUsableText = (m: ExportedMessage): boolean =>
    m.content.trim().length >= 3 && !/^https?:\/\/\S+$/.test(m.content.trim())

const clip = (text: string): string =>
    text.length > MAX_EXAMPLE_CHARS
        ? `${text.slice(0, MAX_EXAMPLE_CHARS)}…`
        : text

/** Score messages with Jev, CONCURRENCY at a time. Failed calls are dropped. */
const scoreAll = async (
    model: ShitpostModel | null,
    messages: ExportedMessage[]
): Promise<{ message: ExportedMessage; p: number }[]> => {
    const question = buildShitpostQuestion(model)
    const results: { message: ExportedMessage; p: number }[] = []
    let next = 0
    const worker = async () => {
        while (next < messages.length) {
            const message = messages[next++]!
            try {
                const { answers } = await getTypeSafeClient().systemOne({
                    state: message.content,
                    questions: { shitpost: question },
                })
                results.push({ message, p: answers.shitpost.noul })
            } catch (e) {
                console.log(
                    `   scoring failed for ${message.id}: ${(e as Error).message}`
                )
            }
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    return results
}

type ThresholdStats = {
    threshold: number
    recall: number
    falsePositiveRate: number
}

const evaluate = (
    scored: { message: ExportedMessage; p: number }[]
): ThresholdStats[] => {
    const pos = scored.filter(
        (s) => s.message.shitpostReactions >= minReactions
    )
    const neg = scored.filter((s) => s.message.shitpostReactions === 0)
    return THRESHOLDS.map((threshold) => ({
        threshold,
        recall: pos.filter((s) => s.p >= threshold).length / pos.length,
        falsePositiveRate:
            neg.filter((s) => s.p >= threshold).length / neg.length,
    }))
}

const printTable = (label: string, stats: ThresholdStats[]) => {
    console.log(`\n${label}`)
    console.log('  threshold | catches shitposts | false alarms on normal msgs')
    for (const s of stats) {
        console.log(
            `     ${s.threshold.toFixed(1)}    |       ${(s.recall * 100).toFixed(0).padStart(3)}%        |     ${(s.falsePositiveRate * 100).toFixed(1).padStart(5)}%`
        )
    }
}

async function main() {
    // Tolerate a half-written last line so training can run mid-export.
    const all = fs
        .readFileSync(HISTORY, 'utf8')
        .split('\n')
        .flatMap((line) => {
            try {
                return line ? [JSON.parse(line) as ExportedMessage] : []
            } catch {
                return []
            }
        })
    const settledBefore = Date.now() - SETTLE_MS
    const usable = all.filter(isUsableText)
    const reacted = usable.filter((m) => m.shitpostReactions >= minReactions)
    // A message from before the server started using the emoji isn't "normal",
    // it's unlabeled. Labels start at the 3rd-earliest reacted message, which
    // ignores a stray reaction added later to some old post.
    const labelsSince =
        reacted.map((m) => Date.parse(m.createdAt)).sort((a, b) => a - b)[
            Math.min(2, reacted.length - 1)
        ] ?? 0
    const shitposts = shuffle(
        reacted.filter((m) => Date.parse(m.createdAt) >= labelsSince)
    )
    const normal = shuffle(
        usable.filter((m) => {
            const at = Date.parse(m.createdAt)
            return (
                m.shitpostReactions === 0 &&
                at >= labelsSince &&
                at < settledBefore
            )
        })
    )
    const baseRate = shitposts.length / (shitposts.length + normal.length)
    console.log(
        `=== ${all.length} messages, ${usable.length} usable text; labels since ` +
            `${new Date(labelsSince).toISOString().slice(0, 10)}: ` +
            `${shitposts.length} shitposts (≥${minReactions} reaction), ${normal.length} normal ` +
            `(${(baseRate * 100).toFixed(1)}% shitpost rate) ===`
    )
    if (shitposts.length < 20)
        throw new Error(
            'Too few labeled shitposts to train on; lower SHITPOST_MIN_REACTIONS or scan more channels'
        )

    // Split: first part feeds examples, the rest is the held-out test set.
    const examplePoolSize = Math.min(
        Math.floor(shitposts.length / 2),
        examplesPerSide * 2
    )
    const posPool = shitposts.slice(0, examplePoolSize)
    const posTest = shitposts.slice(examplePoolSize).slice(0, testPerSide)
    const negPool = normal.slice(0, examplesPerSide * 2)
    const negTest = normal.slice(examplesPerSide * 2).slice(0, testPerSide)

    // Strongest signal first: the most-reacted shitposts make the best examples.
    const model: ShitpostModel = {
        generatedAt: new Date().toISOString(),
        minReactions,
        threshold: 0.5,
        examples: {
            yes: [...posPool]
                .sort((a, b) => b.shitpostReactions - a.shitpostReactions)
                .slice(0, examplesPerSide)
                .map((m) => clip(m.content)),
            no: negPool.slice(0, examplesPerSide).map((m) => clip(m.content)),
        },
        metrics: [],
    }
    console.log(
        `Teaching with ${model.examples.yes.length}+${model.examples.no.length} examples; ` +
            `testing on ${posTest.length} shitposts + ${negTest.length} normal messages it never saw`
    )

    const testSet = [...posTest, ...negTest]
    console.log('\nScoring without examples (baseline)…')
    const baseline = evaluate(await scoreAll(null, testSet))
    printTable('Baseline (description only):', baseline)

    console.log('\nScoring with examples…')
    const trained = evaluate(await scoreAll(model, testSet))
    printTable('With examples:', trained)

    const pick = trained.find(
        (s) => s.falsePositiveRate <= MAX_FALSE_POSITIVE_RATE
    )
    model.threshold = pick?.threshold ?? 0.9
    model.metrics = trained
    console.log(
        `\nChosen threshold ${model.threshold}: catches ${((pick?.recall ?? 0) * 100).toFixed(0)}% of shitposts, ` +
            `false alarm on ${((pick?.falsePositiveRate ?? 0) * 100).toFixed(1)}% of normal messages`
    )

    // Below this, most of Rushmore's reactions would land on normal messages.
    if (!pick || pick.recall < MIN_USEFUL_RECALL) {
        console.log(
            `⚠️  Not reliable enough to enable: at an acceptable false-alarm rate it ` +
                `catches under ${MIN_USEFUL_RECALL * 100}% of shitposts. Keep SHITPOST_REACT_ENABLED=false.`
        )
    }

    fs.writeFileSync(SHITPOST_MODEL_PATH, JSON.stringify(model, null, 2))
    console.log(`✅ Saved ${SHITPOST_MODEL_PATH}`)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
