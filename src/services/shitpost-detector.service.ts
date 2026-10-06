import fs from 'fs'
import path from 'path'
import { Message } from 'discord.js'
import { noul, NoulQuestion } from '@typesafe-ai/sdk'
import { getTypeSafeClient } from '../components/typesafeClient'
import { getWatchedUserIds } from './message-relocator.service'

/**
 * Output of src/scripts/train-shitpost-detector.ts: real examples of the
 * watched user's shitposts and normal messages, plus the threshold measured on
 * held-out history. Gitignored because it contains real messages; copy it to
 * the host alongside the bundle.
 */
export type ShitpostModel = {
    generatedAt: string
    minReactions: number
    threshold: number
    examples: { yes: string[]; no: string[] }
    metrics: { threshold: number; recall: number; falsePositiveRate: number }[]
}

export const SHITPOST_MODEL_PATH = path.join(
    process.cwd(),
    'data',
    'shitpost-examples.json'
)

const loadModel = (): ShitpostModel | null => {
    try {
        return JSON.parse(fs.readFileSync(SHITPOST_MODEL_PATH, 'utf8'))
    } catch {
        return null
    }
}

/**
 * The yes/no question Jev answers. With a model, the criteria carry real
 * examples from this user's history so Jev learns what the server considers a
 * shitpost from him; without one it's the bare description (training baseline).
 */
export const buildShitpostQuestion = (
    model: ShitpostModel | null
): NoulQuestion =>
    noul(
        {
            question:
                'Is this Discord message (Spanish, may mix English) a shitpost by this user?',
            focus: 'Judge the message as this specific user writes; the examples show how the server labels his posts.',
        },
        {
            true: {
                what: 'Low-effort, trolling, provocative, absurd or annoying message posted to bait a reaction or derail the chat.',
                ...(model && { examples: model.examples.yes }),
            },
            false: {
                what: 'A normal, sincere message: conversation, questions, plans, information or genuine opinions.',
                ...(model && { examples: model.examples.no }),
            },
        }
    )

const model = loadModel()
const question = model && buildShitpostQuestion(model)
if (model) {
    console.log(
        `[shitpost-detector] loaded ${model.examples.yes.length}+${model.examples.no.length} examples, ` +
            `threshold ${model.threshold} (${model.generatedAt})`
    )
}

const parsedCap = Number(process.env.SHITPOST_REACT_MAX_PER_DAY)
const MAX_REACTIONS_PER_DAY =
    Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : 10
let reactionsToday = { day: '', count: 0 }

const underDailyCap = (): boolean => {
    const day = new Date().toISOString().slice(0, 10)
    if (reactionsToday.day !== day) reactionsToday = { day, count: 0 }
    return reactionsToday.count < MAX_REACTIONS_PER_DAY
}

/**
 * React with the shitpost emoji when Jev thinks the watched user's message is
 * a shitpost. Off unless SHITPOST_REACT_ENABLED=true and a trained model
 * exists. Best-effort: errors are logged and ignored.
 */
export const maybeReactToShitpost = async (message: Message): Promise<void> => {
    const emojiId = process.env.SHITPOST_TRIGGER_EMOJI
    if (
        process.env.SHITPOST_REACT_ENABLED !== 'true' ||
        !model ||
        !question ||
        !emojiId ||
        !getWatchedUserIds().includes(message.author.id) ||
        message.content.trim().length < 3 ||
        !underDailyCap()
    )
        return

    try {
        const { answers } = await getTypeSafeClient().systemOne({
            state: message.content,
            questions: { shitpost: question },
        })
        const p = answers.shitpost.noul
        console.log(`[shitpost-detector] jev p(shitpost)=${p.toFixed(3)}`)
        if (p < model.threshold || !underDailyCap()) return

        reactionsToday.count++
        await message.react(emojiId)
    } catch (e) {
        console.log('[shitpost-detector] failed, skipping:', e)
    }
}
