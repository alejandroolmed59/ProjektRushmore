import { loadLearnedKeywords } from './learned-keywords.service'
import { jevSaysYes } from '../components/typesafeClient'

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
// these shows up without a strong keyword we escalate to Jev rather than
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

// Merge the built-in lists with the keywords previously learned from the
// watched user's real history (deduped, accent-normalized to match).
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

// Single-word strong keywords long enough to fuzzy match. Short ones (gol,
// var, fc) are one typo away from too many ordinary words.
const MIN_FUZZY_LENGTH = 5
const FUZZY_KEYWORDS = Array.from(
    new Set([...STRONG_KEYWORDS, ...(learned?.strong ?? [])].map(normalize))
).filter((w) => !w.includes(' ') && w.length >= MIN_FUZZY_LENGTH)

/**
 * True when `a` and `b` differ by at most one insertion, deletion,
 * substitution or swap of adjacent letters ("mbape" vs "mbappe").
 */
const withinOneEdit = (a: string, b: string): boolean => {
    if (Math.abs(a.length - b.length) > 1) return false
    let i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i++
    if (a.length === b.length) {
        if (a.slice(i + 1) === b.slice(i + 1)) return true // substitution
        return (
            a[i] === b[i + 1] &&
            a[i + 1] === b[i] &&
            a.slice(i + 2) === b.slice(i + 2)
        ) // adjacent swap
    }
    const [shorter, longer] = a.length < b.length ? [a, b] : [b, a]
    return shorter.slice(i) === longer.slice(i + 1) // insertion/deletion
}

// Misspelled strong keywords: a word one typo away from one escalates to Jev
// instead of counting as a hit, so ordinary near-misses don't get moved.
const hasNearMiss = (text: string): boolean =>
    (text.match(/[a-z0-9]+/g) ?? []).some(
        (word) =>
            word.length >= MIN_FUZZY_LENGTH - 1 &&
            FUZZY_KEYWORDS.some((k) => withinOneEdit(word, k))
    )
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
 * - 'yes'   -> definitely football, no Jev call needed
 * - 'no'    -> no football signal at all
 * - 'maybe' -> ambiguous or a misspelled keyword, escalate to Jev
 */
export const keywordHasFootball = (content: string): 'yes' | 'no' | 'maybe' => {
    const text = normalize(content)

    if (STRONG_MATCHERS.some((m) => matches(text, m))) return 'yes'
    if (AMBIGUOUS_MATCHERS.some((m) => matches(text, m))) return 'maybe'
    if (hasNearMiss(text)) return 'maybe'
    return 'no'
}
const FOOTBALL_QUESTION =
    'This is a Discord message written in Spanish (it may mix in English). ' +
    'Is it about football/soccer? Counts as football: the sport, players, ' +
    'matches, leagues, teams, results, transfers or football memes. Other ' +
    'sports and general chatter do NOT count.'

/**
 * Ask Jev whether a (Spanish) message is about football/soccer. Fails open so
 * we never delete a message we're unsure about.
 */
export const jevIsFootball = (content: string): Promise<boolean> =>
    jevSaysYes('football-detector', FOOTBALL_QUESTION, content)

/**
 * Two-stage detection: keyword pre-check first, Jev only for ambiguous cases.
 */
export const isFootballMessage = async (content: string): Promise<boolean> => {
    const verdict = keywordHasFootball(content)
    if (verdict === 'yes') return true
    if (verdict === 'no') return false
    return jevIsFootball(content)
}
