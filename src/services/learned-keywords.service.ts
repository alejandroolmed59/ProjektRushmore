import fs from 'fs'
import path from 'path'

/**
 * Keywords learned from the watched user's real message history by the one-time
 * bootstrap (see src/scripts/analyze-user-history.ts). The live detector merges
 * these on top of its built-in list so detection is tuned to how this specific
 * person actually talks about football.
 */
export type LearnedKeywords = {
    generatedAt: string
    model: string
    messagesAnalyzed: number
    strong: string[]
    ambiguous: string[]
}

// Stored under the project's data/ dir so it survives across runs and is shared
// by both the bootstrap script and the live bot. Resolved from cwd so it works
// the same under ts-node and the esbuild bundle.
const DATA_DIR = path.join(process.cwd(), 'data')
const KEYWORDS_FILE = path.join(DATA_DIR, 'learned-keywords.json')

export const learnedKeywordsPath = (): string => KEYWORDS_FILE

/** True once the one-time analysis has run and written its output. */
export const hasLearnedKeywords = (): boolean => fs.existsSync(KEYWORDS_FILE)

/** Load the learned keywords, or null if the bootstrap hasn't run yet. */
export const loadLearnedKeywords = (): LearnedKeywords | null => {
    try {
        if (!fs.existsSync(KEYWORDS_FILE)) return null
        return JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8'))
    } catch (e) {
        console.log('[learned-keywords] failed to load, ignoring:', e)
        return null
    }
}

export const saveLearnedKeywords = (data: LearnedKeywords): void => {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(data, null, 2))
}
