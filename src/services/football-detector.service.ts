import { loadLearnedKeywords } from './learned-keywords.service'
import { getClient } from '../components/geminiClient'

// Strong football/soccer signals. The watched user posts in Spanish, so the
// list is Spanish-first with a few code-switched English terms mixed in.
const STRONG_KEYWORDS: string[] = [
    'futbol',
    'soccer',
    'gol',
    'golazo',
    'penal',
    'penalti',
    'penalty',
    'tiro libre',
    'corner',
    'arquero',
    'portero',
    'delantero',
    'mediocampo',
    'offside',
    'fuera de lugar',
    'var',
    'mundial',
    'champions',
    'libertadores',
    'laliga',
    'premier',
    'bundesliga',
    'seriea',
    'liga mx',
    'messi',
    'cristiano',
    'ronaldo',
    'mbappe',
    'neymar',
    'haaland',
    'barcelona',
    'real madrid',
    'madridista',
    'culer',
    'fc',
    'cf',
    'fifa',
    'uefa',
    'concacaf',
    'seleccion',
    'hat trick',
    'hattrick',
]

// Ambiguous words that could be football but also generic chatter. When one of
// these shows up without a strong keyword we escalate to the LLM rather than
// guessing.
const AMBIGUOUS_KEYWORDS: string[] = [
    'partido',
    'equipo',
    'jugada',
    'jugador',
    'cancha',
    'estadio',
    'liga',
    'torneo',
    'campeon',
    'campeonato',
    'eliminado',
    'clasico',
    'derbi',
    'derby',
    'hincha',
    'aficion',
    'tecnico',
    'dt',
    'fichaje',
    'transferencia',
]

const COMBINING_MARKS = /[̀-ͯ]/g
const normalize = (text: string): string =>
    text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '') // strip accents

// Multi-word keywords match as a substring; single tokens match on word
// boundaries to avoid false hits inside longer words. Compile each matcher
// once at module load rather than per message.
type Matcher = { phrase: string } | { regex: RegExp }
const compileMatcher = (needle: string): Matcher => {
    if (needle.includes(' ')) return { phrase: needle }
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return { regex: new RegExp(`\\b${escaped}\\b`) }
}
const matches = (text: string, m: Matcher): boolean =>
    'phrase' in m ? text.includes(m.phrase) : m.regex.test(text)

// Merge the built-in lists with anything the one-time bootstrap learned from
// the watched user's real history (deduped, accent-normalized to match).
const learned = loadLearnedKeywords()
const buildMatchers = (builtIn: string[], extra: string[]): Matcher[] => {
    const deduped = Array.from(
        new Set(
            [...builtIn, ...extra].map(normalize).filter((w) => w.length > 0)
        )
    )
    return deduped.map(compileMatcher)
}

const STRONG_MATCHERS = buildMatchers(STRONG_KEYWORDS, learned?.strong ?? [])
const AMBIGUOUS_MATCHERS = buildMatchers(
    AMBIGUOUS_KEYWORDS,
    learned?.ambiguous ?? []
)

if (learned) {
    console.log(
        `[football-detector] loaded ${learned.strong.length} learned strong + ` +
            `${learned.ambiguous.length} ambiguous keywords ` +
            `(from ${learned.messagesAnalyzed} msgs, ${learned.generatedAt})`
    )
}

/**
 * Cheap, synchronous pre-check.
 * - 'yes'   -> definitely football, no LLM needed
 * - 'no'    -> no football signal at all
 * - 'maybe' -> ambiguous, escalate to Gemini
 */
export const keywordHasFootball = (content: string): 'yes' | 'no' | 'maybe' => {
    const text = normalize(content)

    if (STRONG_MATCHERS.some((m) => matches(text, m))) return 'yes'
    if (AMBIGUOUS_MATCHERS.some((m) => matches(text, m))) return 'maybe'
    return 'no'
}
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? ''
/**
 * Ask Gemini Flash whether a (Spanish) message is about football/soccer.
 * Fails open: any error returns false so we never delete a message we're
 * unsure about.
 */
export const geminiIsFootball = async (content: string): Promise<boolean> => {
    try {
        const prompt = `El siguiente mensaje de Discord está escrito en español (puede mezclar inglés). ¿Habla de fútbol/soccer? Cuenta como fútbol: el deporte, jugadores, partidos, ligas, equipos, resultados, fichajes o memes futboleros. NO cuenta otro deporte ni charla general. Responde ÚNICAMENTE con la palabra SI o NO.\n\nMensaje: """${content}"""`

        const response = await getClient().models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        })

        const answer = (response.text ?? '').trim().toLowerCase()
        console.log(`geminiIsFootball answer ${answer}`)
        return (
            answer.startsWith('si') ||
            answer.startsWith('sí') ||
            answer.startsWith('yes')
        )
    } catch (e) {
        console.log(
            '[football-detector] Gemini error, failing open (no match):',
            e
        )
        return false
    }
}

// Cap how much text we send Gemini in one extraction call to stay well within
// the model's context and keep the request cheap.
const EXTRACTION_BATCH_SIZE = 200

export type ExtractedKeywords = { strong: string[]; ambiguous: string[] }
export type ExtractionResult = ExtractedKeywords & {
    totalBatches: number
    failedBatches: number
}

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))

const isRetryable = (e: unknown): boolean => {
    const status = (e as { status?: number })?.status
    return status === 503 || status === 429 || status === 500
}

const cleanList = (value: unknown): string[] =>
    Array.isArray(value)
        ? value
              .filter((v): v is string => typeof v === 'string')
              .map((v) => v.trim().toLowerCase())
              .filter((v) => v.length > 0)
        : []

/**
 * One-time bootstrap helper: show Gemini a batch of the watched user's real
 * messages and have it extract the football keywords/phrases THIS user actually
 * uses, split into strong (unambiguously football) vs ambiguous signals.
 */
const extractBatch = async (messages: string[]): Promise<ExtractedKeywords> => {
    const corpus = messages.map((m) => `- ${m.replace(/\n/g, ' ')}`).join('\n')
    const prompt = `Eres un analista de lenguaje. Abajo hay mensajes reales de Discord (en español, a veces con inglés) de UN usuario. Extrae las palabras y frases que esta persona usa cuando habla de FÚTBOL/SOCCER (el deporte, jugadores, equipos, ligas, partidos, resultados, fichajes, memes futboleros).

Clasifícalas en:
- "strong": términos que casi siempre indican fútbol por sí solos.
- "ambiguous": términos que podrían ser fútbol u otra cosa según el contexto.

Reglas: usa minúsculas, sin signos de puntuación, sin duplicados, máximo ~40 por lista, solo términos presentes o claramente implícitos en los mensajes. Si no hay señales de fútbol, devuelve listas vacías. Responde SOLO con JSON: {"strong": string[], "ambiguous": string[]}.

Mensajes:
${corpus}`

    // Retry transient overload/rate-limit errors with exponential backoff.
    const maxAttempts = 4
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await getClient().models.generateContent({
                model: GEMINI_MODEL,
                contents: prompt,
                config: { responseMimeType: 'application/json' },
            })
            const parsed = JSON.parse(response.text ?? '{}')
            return {
                strong: cleanList(parsed.strong),
                ambiguous: cleanList(parsed.ambiguous),
            }
        } catch (e) {
            if (isRetryable(e) && attempt < maxAttempts) {
                const waitMs = 1000 * 2 ** (attempt - 1)
                console.log(
                    `[football-detector] batch attempt ${attempt} failed (retryable), retrying in ${waitMs}ms...`
                )
                await sleep(waitMs)
                continue
            }
            throw e
        }
    }
    // Unreachable: the loop either returns or throws.
    throw new Error('extraction batch exhausted retries')
}

/**
 * Run Gemini extraction over the user's whole history (in batches) and return
 * the deduped union. Built-in keywords are excluded so we only persist what's
 * genuinely new for this user.
 */
export const extractKeywordsFromHistory = async (
    messages: string[],
    onProgress?: (done: number, total: number) => void
): Promise<ExtractionResult> => {
    const builtIn = new Set(
        [...STRONG_KEYWORDS, ...AMBIGUOUS_KEYWORDS].map(normalize)
    )
    const strong = new Set<string>()
    const ambiguous = new Set<string>()
    let totalBatches = 0
    let failedBatches = 0

    for (let i = 0; i < messages.length; i += EXTRACTION_BATCH_SIZE) {
        const batch = messages.slice(i, i + EXTRACTION_BATCH_SIZE)
        totalBatches++
        try {
            const result = await extractBatch(batch)
            result.strong.forEach((w) => {
                if (!builtIn.has(normalize(w))) strong.add(w)
            })
            result.ambiguous.forEach((w) => {
                if (!builtIn.has(normalize(w)) && !strong.has(w))
                    ambiguous.add(w)
            })
        } catch (e) {
            failedBatches++
            console.log('[football-detector] extraction batch gave up:', e)
        }
        onProgress?.(
            Math.min(i + batch.length, messages.length),
            messages.length
        )
    }

    return {
        strong: [...strong],
        ambiguous: [...ambiguous],
        totalBatches,
        failedBatches,
    }
}

/**
 * Two-stage detection: keyword pre-check first, Gemini only for ambiguous cases.
 */
export const isFootballMessage = async (content: string): Promise<boolean> => {
    const verdict = keywordHasFootball(content)
    if (verdict === 'yes') return true
    if (verdict === 'no') return false
    return geminiIsFootball(content)
}
