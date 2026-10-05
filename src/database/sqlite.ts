import fs from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'

// Local SQLite store for the reminders/debts feature. Lives next to the bot on
// the host (the Pixel), so it needs no cloud service. Resolved from cwd like
// data/learned-keywords.json so ts-node and the esbuild bundle agree.
const DB_PATH =
    process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'rushmore.db')
const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups')
const BACKUPS_TO_KEEP = 7

const SCHEMA = `
CREATE TABLE IF NOT EXISTS charges (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL CHECK (kind IN ('monthly', 'oneoff')),
    name            TEXT NOT NULL,
    creditor_id     TEXT NOT NULL,
    channel_id      TEXT NOT NULL,
    nag_every_days  INTEGER NOT NULL,
    day_of_month    INTEGER,
    next_run_at     INTEGER,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      INTEGER NOT NULL
);

-- Who pays how much each period of a monthly charge.
CREATE TABLE IF NOT EXISTS charge_members (
    charge_id     TEXT NOT NULL REFERENCES charges(id),
    user_id       TEXT NOT NULL,
    amount_cents  INTEGER NOT NULL,
    PRIMARY KEY (charge_id, user_id)
);

-- open -> claimed (debtor says paid) -> paid (creditor confirmed).
-- A rejected claim goes back to open.
CREATE TABLE IF NOT EXISTS debts (
    id            TEXT PRIMARY KEY,
    charge_id     TEXT NOT NULL REFERENCES charges(id),
    period        TEXT NOT NULL,
    debtor_id     TEXT NOT NULL,
    creditor_id   TEXT NOT NULL,
    amount_cents  INTEGER NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('open', 'claimed', 'paid')),
    next_nag_at   INTEGER,
    created_at    INTEGER NOT NULL,
    paid_at       INTEGER,
    UNIQUE (charge_id, period, debtor_id)
);
CREATE INDEX IF NOT EXISTS debts_due ON debts (status, next_nag_at);
`

let db: DatabaseSync | null = null
export const getDb = (): DatabaseSync => {
    if (!db) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
        db = new DatabaseSync(DB_PATH)
        db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
        db.exec(SCHEMA)
    }
    return db
}

/** Run fn inside a transaction, rolling back if it throws. */
export const transaction = <T>(fn: () => T): T => {
    const database = getDb()
    database.exec('BEGIN')
    try {
        const result = fn()
        database.exec('COMMIT')
        return result
    } catch (e) {
        database.exec('ROLLBACK')
        throw e
    }
}

/**
 * Write a consistent snapshot to data/backups/rushmore-YYYY-MM-DD.db (at most
 * one per day) and prune old ones.
 */
export const backupDb = (now: Date = new Date()): void => {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const file = path.join(
        BACKUP_DIR,
        `rushmore-${now.toISOString().slice(0, 10)}.db`
    )
    if (fs.existsSync(file)) return
    getDb().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)

    const backups = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => /^rushmore-\d{4}-\d{2}-\d{2}\.db$/.test(f))
        .sort()
    backups
        .slice(0, Math.max(0, backups.length - BACKUPS_TO_KEEP))
        .forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)))
}
