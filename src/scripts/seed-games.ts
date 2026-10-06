/**
 * Load the game library (copies, aliases and loans) from a JSON file into the
 * SQLite DB. Safe to run more than once: existing copies, aliases and loans
 * are skipped.
 *
 * Runs on the host next to the bot (same SQLite DB):
 *   npm run build:seed   (on the Mac), copy dist/seed-games.js and the JSON, then
 *   node dist/seed-games.js [data/games-seed.json]   (on the phone, from ~/rushmore)
 *
 * The JSON holds real Discord IDs, so it lives in data/ and is gitignored:
 * {
 *   "players": { "ra": "<discord id>", ... },
 *   "games": [{ "title": "...", "owner": "ra", "format": "fisico", "aliases": ["..."] }],
 *   "loans": [{ "title": "...", "owner": "ra", "borrower": "justin",
 *               "lentAt": "2026-10-04", "returnedAt": null, "note": null }]
 * }
 * Dates are local days (El Salvador); they're stored at local noon.
 */
import fs from 'fs'
import path from 'path'
import { getDb } from '../database/sqlite'
import {
    addGame,
    GameFormat,
    insertLoan,
    normalizeTitle,
    openLoan,
    ownedCopies,
} from '../services/games.service'

type SeedFile = {
    players: Record<string, string>
    games: {
        title: string
        owner: string
        format: GameFormat
        aliases?: string[]
    }[]
    loans?: {
        title: string
        owner: string
        borrower: string
        lentAt: string
        returnedAt?: string | null
        note?: string | null
    }[]
}

const LOCAL_NOON_UTC_HOUR = 18 // UTC-6, no DST

const file =
    process.argv[2] ?? path.join(process.cwd(), 'data', 'games-seed.json')
const seed = JSON.parse(fs.readFileSync(file, 'utf8')) as SeedFile

const playerId = (name: string): string => {
    const id = seed.players[name.toLowerCase()]
    if (!id) throw new Error(`Unknown player "${name}" in ${file}`)
    return id
}

const parseDay = (day: string): number => {
    const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) throw new Error(`Bad date "${day}", use YYYY-MM-DD`)
    return Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        LOCAL_NOON_UTC_HOUR
    )
}

const main = (): void => {
    let added = 0
    for (const g of seed.games) {
        const { status } = addGame({
            title: g.title,
            ownerId: playerId(g.owner),
            format: g.format,
            aliases: g.aliases ?? [],
        })
        if (status === 'added') added++
    }
    console.log(
        `games: ${added} added, ${seed.games.length - added} already there`
    )

    let loans = 0
    for (const l of seed.loans ?? []) {
        const [game] = ownedCopies(
            playerId(l.owner),
            normalizeTitle(l.title),
            'fisico'
        )
        if (!game)
            throw new Error(`No physical "${l.title}" owned by ${l.owner}`)
        const borrowerId = playerId(l.borrower)
        const lentAt = parseDay(l.lentAt)
        const returnedAt = l.returnedAt ? parseDay(l.returnedAt) : null

        const exists = getDb()
            .prepare(
                'SELECT 1 FROM game_loans WHERE game_id = ? AND borrower_id = ? AND lent_at = ?'
            )
            .get(game.id, borrowerId, lentAt)
        if (exists) continue
        if (returnedAt === null && openLoan(game.id)) {
            console.log(`skip: "${l.title}" already has an open loan`)
            continue
        }
        insertLoan({
            gameId: game.id,
            borrowerId,
            lentAt,
            returnedAt,
            note: l.note ?? null,
        })
        loans++
    }
    console.log(`loans: ${loans} added`)
}

// addGame runs its own transaction and SQLite can't nest them, so this isn't
// one big transaction; it's idempotent, so a failed run can simply be rerun.
main()
