import fs from 'fs'
import path from 'path'

/**
 * Keywords learned once from the watched user's real message history (the
 * Gemini bootstrap that produced data/learned-keywords.json has since been
 * removed; edit the file by hand to add more). The live detector merges these
 * on top of its built-in list so detection is tuned to how this specific
 * person actually talks about football.
 */
export type LearnedKeywords = {
    generatedAt: string
    model: string
    messagesAnalyzed: number
    strong: string[]
    ambiguous: string[]
}

// Resolved from cwd so it works the same under ts-node and the esbuild bundle.
const KEYWORDS_FILE = path.join(process.cwd(), 'data', 'learned-keywords.json')

/** Load the learned keywords, or null if the file is missing. */
export const loadLearnedKeywords = (): LearnedKeywords | null => {
    try {
        if (!fs.existsSync(KEYWORDS_FILE)) return null
        return JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8'))
    } catch (e) {
        console.log('[learned-keywords] failed to load, ignoring:', e)
        return null
    }
}
