import { choice, ChoiceCriteria, noul, TypeSafeClient } from '@typesafe-ai/sdk'

// Pinned so the probability threshold we tune keeps meaning the same thing
// when TypeSafe ships a new jev-latest.
const DEFAULT_MODEL = 'jev-1.13.0'

let typesafeClient: TypeSafeClient | null = null
export const getTypeSafeClient = (): TypeSafeClient => {
    if (!typesafeClient) {
        typesafeClient = new TypeSafeClient({
            apiKey: process.env.TYPESAFE_API_KEY ?? '',
            defaultModel: process.env.TYPESAFE_DEFAULT_MODEL || DEFAULT_MODEL,
        })
    }
    return typesafeClient
}

const parsedThreshold = Number(process.env.TYPESAFE_THRESHOLD)
const THRESHOLD =
    Number.isFinite(parsedThreshold) && parsedThreshold > 0
        ? parsedThreshold
        : 0.5

/**
 * Ask Jev a yes/no question about a message. Returns the probability that the
 * answer is "yes" compared against TYPESAFE_THRESHOLD. Fails open: any error
 * returns false so callers never act on a message we're unsure about.
 */
export const jevSaysYes = async (
    tag: string,
    question: string,
    content: string
): Promise<boolean> => {
    try {
        const { answers } = await getTypeSafeClient().systemOne({
            state: content,
            questions: { answer: noul(question) },
        })
        const probability = answers.answer.noul
        console.log(`[${tag}] jev p(yes)=${probability.toFixed(3)}`)
        return probability >= THRESHOLD
    } catch (e) {
        console.log(`[${tag}] Jev error, failing open (no match):`, e)
        return false
    }
}

/**
 * Ask Jev to pick one label for a piece of text. Returns the label and Jev's
 * confidence in it, or null on any error so callers fail open.
 */
export const jevChoose = async (
    tag: string,
    instructions: string,
    content: string,
    criteria: ChoiceCriteria
): Promise<{ label: string; confidence: number } | null> => {
    try {
        const { answers } = await getTypeSafeClient().systemOne({
            state: content,
            questions: { answer: choice(instructions, criteria) },
        })
        const { choice: label, confidence } = answers.answer
        console.log(`[${tag}] jev chose "${label}" (${confidence.toFixed(3)})`)
        return { label, confidence }
    } catch (e) {
        console.log(`[${tag}] Jev error, failing open (no choice):`, e)
        return null
    }
}
