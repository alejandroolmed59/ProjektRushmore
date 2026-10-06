import { getDb, transaction } from '../database/sqlite'
import { GenerateLongerId } from '../utils/id-generator'

export type GameFormat = 'fisico' | 'digital'

export type Game = {
    id: string
    title: string
    title_key: string
    owner_id: string
    format: GameFormat
    active: number
    created_at: number
}

/** A distinct title in the library with every key it can be found by. */
export type TitleEntry = {
    titleKey: string
    title: string
    aliases: string[]
}

export type TitleMatch =
    | { kind: 'match'; entry: TitleEntry }
    | { kind: 'ambiguous'; candidates: TitleEntry[] }
    | { kind: 'none' }

// Filler words people add or drop when naming a game ("zelda de echoes").
// A query token in this list never has to match.
const STOPWORDS = new Set([
    'de',
    'del',
    'el',
    'la',
    'los',
    'las',
    'y',
    'the',
    'of',
    'and',
])

// ---------- normalization ----------

/** "Pokémon Sword!" -> "pokemon sword". Used for titles, aliases and queries. */
export const normalizeTitle = (raw: string): string =>
    raw
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

const words = (key: string): string[] => key.split(' ').filter(Boolean)

// ---------- catalog ----------

const getGameByKey = (
    ownerId: string,
    titleKey: string,
    format: GameFormat
): Game | undefined =>
    getDb()
        .prepare(
            'SELECT * FROM games WHERE owner_id = ? AND title_key = ? AND format = ?'
        )
        .get(ownerId, titleKey, format) as Game | undefined

/** Title key an alias points to, if any. */
const aliasTarget = (key: string): string | undefined =>
    (
        getDb()
            .prepare('SELECT title_key FROM game_aliases WHERE alias_key = ?')
            .get(key) as { title_key: string } | undefined
    )?.title_key

/** Display title already used for a key, so every copy shows the same name. */
const existingTitle = (titleKey: string): string | undefined =>
    (
        getDb()
            .prepare(
                'SELECT title FROM games WHERE title_key = ? ORDER BY created_at LIMIT 1'
            )
            .get(titleKey) as { title: string } | undefined
    )?.title

/**
 * Add a copy of a game. A title that is a known alias ("TOTK") is stored
 * under its canonical title. Re-adding a removed copy brings it back.
 */
export const addGame = (input: {
    title: string
    ownerId: string
    format: GameFormat
    aliases?: string[]
    now?: number
}): { status: 'added' | 'exists'; game: Game } => {
    const now = input.now ?? Date.now()
    const typedKey = normalizeTitle(input.title)
    const titleKey = aliasTarget(typedKey) ?? typedKey
    const title = existingTitle(titleKey) ?? input.title.trim()

    return transaction(() => {
        addAliases(titleKey, input.aliases ?? [])
        const existing = getGameByKey(input.ownerId, titleKey, input.format)
        if (existing?.active) return { status: 'exists', game: existing }
        if (existing) {
            getDb()
                .prepare('UPDATE games SET active = 1, title = ? WHERE id = ?')
                .run(title, existing.id)
            return {
                status: 'added',
                game: { ...existing, active: 1, title },
            }
        }
        const game: Game = {
            id: GenerateLongerId(),
            title,
            title_key: titleKey,
            owner_id: input.ownerId,
            format: input.format,
            active: 1,
            created_at: now,
        }
        getDb()
            .prepare(
                `INSERT INTO games (id, title, title_key, owner_id, format, active, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
                game.id,
                game.title,
                game.title_key,
                game.owner_id,
                game.format,
                game.active,
                game.created_at
            )
        return { status: 'added', game }
    })
}

/** Register other names for a title. An alias already taken keeps its first title. */
export const addAliases = (titleKey: string, aliases: string[]): void => {
    const insert = getDb().prepare(
        'INSERT OR IGNORE INTO game_aliases (alias_key, title_key) VALUES (?, ?)'
    )
    aliases
        .map(normalizeTitle)
        .filter((key) => key && key !== titleKey)
        .forEach((key) => insert.run(key, titleKey))
}

/** Active copies of a title, physical first. */
export const listCopies = (titleKey: string): Game[] =>
    getDb()
        .prepare(
            `SELECT * FROM games WHERE active = 1 AND title_key = ?
             ORDER BY format DESC, created_at`
        )
        .all(titleKey) as Game[]

/** Active copies, optionally for one owner, grouped by owner then format. */
export const listCatalog = (ownerId?: string): Game[] =>
    (ownerId
        ? getDb()
              .prepare(
                  `SELECT * FROM games WHERE active = 1 AND owner_id = ?
                   ORDER BY format DESC, title`
              )
              .all(ownerId)
        : getDb()
              .prepare(
                  `SELECT * FROM games WHERE active = 1
                   ORDER BY owner_id, format DESC, title`
              )
              .all()) as Game[]

/** The owner's active copies of a title, optionally only one format. */
export const ownedCopies = (
    ownerId: string,
    titleKey: string,
    format?: GameFormat
): Game[] =>
    listCopies(titleKey).filter(
        (g) => g.owner_id === ownerId && (!format || g.format === format)
    )

export type RemoveResult = 'ok' | 'not-found' | 'ambiguous'

/** Soft-delete one of the owner's copies; needs `format` if they own both. */
export const removeGame = (
    ownerId: string,
    titleKey: string,
    format?: GameFormat
): RemoveResult => {
    const copies = ownedCopies(ownerId, titleKey, format)
    const [copy] = copies
    if (!copy) return 'not-found'
    if (copies.length > 1) return 'ambiguous'
    getDb().prepare('UPDATE games SET active = 0 WHERE id = ?').run(copy.id)
    return 'ok'
}

// ---------- matching ----------

/** Every title with at least one active copy, with its aliases. */
export const listTitles = (): TitleEntry[] => {
    const titles = getDb()
        .prepare(
            `SELECT title_key, MIN(title) AS title FROM games WHERE active = 1
             GROUP BY title_key ORDER BY title`
        )
        .all() as { title_key: string; title: string }[]
    const aliases = getDb()
        .prepare('SELECT alias_key, title_key FROM game_aliases')
        .all() as { alias_key: string; title_key: string }[]
    return titles.map((t) => ({
        titleKey: t.title_key,
        title: t.title,
        aliases: aliases
            .filter((a) => a.title_key === t.title_key)
            .map((a) => a.alias_key),
    }))
}

/**
 * True when every meaningful query token is the start of some word in the
 * title or its aliases, so "zelda totk" finds Tears of the Kingdom (title has
 * "zelda", alias has "totk").
 */
const tokensMatch = (tokens: string[], entry: TitleEntry): boolean => {
    const vocabulary = [entry.titleKey, ...entry.aliases].flatMap(words)
    const required = tokens.filter((t) => !STOPWORDS.has(t))
    return (
        required.length > 0 &&
        required.every((t) => vocabulary.some((w) => w.startsWith(t)))
    )
}

/** Resolve what someone typed to a title without calling any API. */
export const matchTitle = (
    query: string,
    entries: TitleEntry[] = listTitles()
): TitleMatch => {
    const key = normalizeTitle(query)
    if (!key) return { kind: 'none' }

    const exact = entries.find(
        (e) => e.titleKey === key || e.aliases.includes(key)
    )
    if (exact) return { kind: 'match', entry: exact }

    const candidates = entries.filter((e) => tokensMatch(words(key), e))
    const [only] = candidates
    if (candidates.length === 1 && only) return { kind: 'match', entry: only }
    if (candidates.length > 1) return { kind: 'ambiguous', candidates }
    return { kind: 'none' }
}

/** Titles for slash command autocomplete: token match, else substring. */
export const searchTitles = (query: string, limit = 25): TitleEntry[] => {
    const entries = listTitles()
    const key = normalizeTitle(query)
    if (!key) return entries.slice(0, limit)
    const byTokens = entries.filter((e) => tokensMatch(words(key), e))
    const results = byTokens.length
        ? byTokens
        : entries.filter((e) =>
              [e.titleKey, ...e.aliases].some((k) => k.includes(key))
          )
    return results.slice(0, limit)
}
