import { getDb } from '../database/sqlite'
import { cachedJevAnswer } from './jev-cache.service'
import { ArchivedMessage } from './message-archive.service'

// Each term is a label shown in /ranking-pene plus a regex over normalized
// text (lowercase, no accents) for its plural, diminutive and augmentative
// forms. The regex is wrapped in word boundaries.
type Term = { label: string; pattern: string }

// Words that mean penis almost every time they're used. Counted without
// asking Jev.
const CLEAR_TERMS: Term[] = [
    { label: 'pene', pattern: 'penes?' },
    { label: 'verga', pattern: 'verg(?:as?|u?itas?|otas?|on|ones|ona|azos?)' },
    { label: 'pito', pattern: 'pit(?:os?|itos?|otes?)' },
    { label: 'polla', pattern: 'poll(?:as?|itas?|on|ones)' },
    { label: 'picha', pattern: 'pich(?:as?|itas?)' },
    { label: 'pichula', pattern: 'pichul(?:as?|itas?|on)' },
    { label: 'poronga', pattern: 'porong(?:as?|uitas?)' },
    { label: 'falo', pattern: 'fal(?:os?|ic[oa]s?)' },
    { label: 'reata', pattern: 'reatas?' },
    { label: 'pirinola', pattern: 'pirinolas?' },
    { label: 'penis', pattern: 'penis(?:es)?' },
    { label: 'dick', pattern: 'dicks?' },
    { label: 'cock', pattern: 'cocks?' },
    { label: 'dong', pattern: 'dongs?' },
    { label: 'schlong', pattern: 'schlongs?' },
    { label: 'wiener', pattern: 'wieners?|weiners?' },
    { label: 'pecker', pattern: 'peckers?' },
]

// Words with an everyday meaning too (a pepper, a country, a posh girl, the
// police). Counted only when Jev says the message is about a penis.
const AMBIGUOUS_TERMS: Term[] = [
    { label: 'pija', pattern: 'pij(?:as?|itas?)' },
    { label: 'chota', pattern: 'chot(?:as?|itas?)' },
    { label: 'minga', pattern: 'mingas?' },
    { label: 'cipote', pattern: 'cipot(?:es?|on)' },
    { label: 'pichi', pattern: 'pichis?' },
    { label: 'pipí', pattern: 'pipis?' },
    { label: 'tula', pattern: 'tulas?' },
    { label: 'chile', pattern: 'chil(?:es?|itos?)' },
    { label: 'nabo', pattern: 'nabos?' },
    { label: 'rabo', pattern: 'rab(?:os?|itos?)' },
    { label: 'pájaro', pattern: 'pajar(?:os?|itos?)' },
    { label: 'plátano', pattern: 'platan(?:os?|itos?)' },
    { label: 'palo', pattern: 'pal(?:os?|itos?)' },
    { label: 'camote', pattern: 'camot(?:es?|itos?)' },
    { label: 'pico', pattern: 'picos?' },
    { label: 'pinga', pattern: 'ping(?:as?|itas?)' },
    { label: 'bicho', pattern: 'bich(?:os?|itos?)' },
    { label: 'paloma', pattern: 'palom(?:as?|itas?)' },
    { label: 'miembro', pattern: 'miembros?' },
    { label: 'chorizo', pattern: 'choriz(?:os?|ote)' },
    { label: 'salchicha', pattern: 'salchich(?:as?|on)' },
    { label: 'pepino', pattern: 'pepin(?:os?|ote)' },
    { label: 'johnson', pattern: 'johnsons?' },
    { label: 'prick', pattern: 'pricks?' },
    { label: 'member', pattern: 'members?' },
    { label: 'tool', pattern: 'tools?' },
    { label: 'rod', pattern: 'rods?' },
    { label: 'willy', pattern: 'willy|willie' },
]

const PENE_QUESTION =
    'This is a Discord message written in Spanish (it may mix in English). ' +
    'Does it use a word to mean a penis, as slang, an insult, a joke or a ' +
    'double meaning (albur)? Words like chile, nabo, pájaro, plátano, palo, ' +
    'pico, pija or tool only count when they mean penis, not their literal ' +
    'meaning (food, a country, a bird, a stick, a posh person).'

const COMBINING_MARKS = /[̀-ͯ]/g
const URL = /https?:\/\/\S+/g
const normalize = (text: string): string =>
    text
        .replace(URL, ' ') // link slugs aren't something anyone said
        .toLowerCase()
        .normalize('NFD')
        .replace(COMBINING_MARKS, '') // strip accents

type Matcher = { label: string; regex: RegExp }
const compile = (terms: Term[]): Matcher[] =>
    terms.map((t) => ({
        label: t.label,
        regex: new RegExp(`\\b(?:${t.pattern})\\b`, 'g'),
    }))
const CLEAR_MATCHERS = compile(CLEAR_TERMS)
const AMBIGUOUS_MATCHERS = compile(AMBIGUOUS_TERMS)

export type TermCounts = Record<string, number>

const countMatches = (text: string, matchers: Matcher[]): TermCounts => {
    const counts: TermCounts = {}
    for (const { label, regex } of matchers) {
        const n = text.match(regex)?.length ?? 0
        if (n > 0) counts[label] = n
    }
    return counts
}

const sum = (counts: TermCounts): number =>
    Object.values(counts).reduce((a, b) => a + b, 0)

/** Occurrences of each term, split by whether Jev has to confirm them. */
export const countPeneTerms = (
    content: string
): { clear: TermCounts; ambiguous: TermCounts } => {
    const text = normalize(content)
    return {
        clear: countMatches(text, CLEAR_MATCHERS),
        ambiguous: countMatches(text, AMBIGUOUS_MATCHERS),
    }
}

export type PeneResult = {
    total: number
    terms: TermCounts
    /** Jev was needed but failed, so ambiguous words were left out. */
    jevFailed: boolean
}

/**
 * Count every penis reference in a message. Clear words always count;
 * ambiguous ones count only if Jev agrees (one call per message, and none at
 * all when the message has no ambiguous word). On a Jev error the ambiguous
 * words are left out and jevFailed is set.
 */
export const classifyPeneMessage = async (
    content: string
): Promise<PeneResult> => {
    const { clear, ambiguous } = countPeneTerms(content)
    let terms = clear
    let jevFailed = false
    if (sum(ambiguous) > 0) {
        const answer = await cachedJevAnswer('pene', PENE_QUESTION, content)
        if (answer === null) jevFailed = true
        // A word can't be in both lists, so the merge never overwrites.
        else if (answer) terms = { ...clear, ...ambiguous }
    }
    return { total: sum(terms), terms, jevFailed }
}

// ---------- storage ----------

/** Save a message's count, replacing any earlier one (edits). */
export const recordPeneMentions = (
    message: ArchivedMessage,
    result: PeneResult
): void => {
    getDb()
        .prepare(
            `INSERT OR REPLACE INTO pene_mentions
                (message_id, channel_id, user_id, count, terms, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
            message.id,
            message.channelId,
            message.authorId,
            result.total,
            JSON.stringify(result.terms),
            message.createdAt
        )
}

export const deletePeneMentions = (messageIds: string[]): void => {
    getDb()
        .prepare(
            'DELETE FROM pene_mentions WHERE message_id IN (SELECT value FROM json_each(?))'
        )
        .run(JSON.stringify(messageIds))
}

export const clearPeneMentions = (): void => {
    getDb().exec('DELETE FROM pene_mentions')
}

export type PeneUserTotal = { user_id: string; total: number }

export const topPeneUsers = (limit = 10): PeneUserTotal[] =>
    getDb()
        .prepare(
            `SELECT user_id, SUM(count) AS total FROM pene_mentions
             GROUP BY user_id ORDER BY total DESC LIMIT ?`
        )
        .all(limit) as PeneUserTotal[]

export type PeneTermTotal = { term: string; total: number }

/** A user's total, their place in the ranking, and their favorite words. */
export const userPeneStats = (
    userId: string,
    termLimit = 5
): { total: number; rank: number; terms: PeneTermTotal[] } => {
    const db = getDb()
    const { total } = db
        .prepare(
            'SELECT COALESCE(SUM(count), 0) AS total FROM pene_mentions WHERE user_id = ?'
        )
        .get(userId) as { total: number }
    const { ahead } = db
        .prepare(
            `SELECT COUNT(*) AS ahead FROM (
                SELECT SUM(count) AS total FROM pene_mentions GROUP BY user_id
             ) WHERE total > ?`
        )
        .get(total) as { ahead: number }
    const terms = db
        .prepare(
            `SELECT j.key AS term, SUM(j.value) AS total
             FROM pene_mentions, json_each(pene_mentions.terms) AS j
             WHERE user_id = ?
             GROUP BY j.key ORDER BY total DESC LIMIT ?`
        )
        .all(userId, termLimit) as PeneTermTotal[]
    return { total, rank: ahead + 1, terms }
}

export const peneStatsSince = (): { total: number; since: number | null } =>
    getDb()
        .prepare(
            'SELECT COALESCE(SUM(count), 0) AS total, MIN(created_at) AS since FROM pene_mentions'
        )
        .get() as { total: number; since: number | null }
