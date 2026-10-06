import fs from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'

// Local SQLite store for every feature (betting, debts, emoji stats, games).
// Lives next to the bot on the host (the Pixel), so it needs no cloud service.
// Resolved from cwd like data/learned-keywords.json so ts-node and the esbuild
// bundle agree.
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

-- One row per emoji use. kind 'message': typed in a message by user_id
-- (count = occurrences). kind 'reaction': user_id reacted on a message by
-- target_user_id. The key makes live tracking and the history backfill
-- idempotent, so they can overlap without double counting.
CREATE TABLE IF NOT EXISTS emoji_uses (
    message_id      TEXT NOT NULL,
    channel_id      TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    target_user_id  TEXT,
    emoji_key       TEXT NOT NULL,
    emoji_name      TEXT NOT NULL,
    animated        INTEGER NOT NULL DEFAULT 0,
    kind            TEXT NOT NULL CHECK (kind IN ('message', 'reaction')),
    count           INTEGER NOT NULL DEFAULT 1,
    created_at      INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji_key, kind)
);
CREATE INDEX IF NOT EXISTS emoji_uses_user ON emoji_uses (user_id, emoji_key);
CREATE INDEX IF NOT EXISTS emoji_uses_target ON emoji_uses (target_user_id, emoji_key);
CREATE INDEX IF NOT EXISTS emoji_uses_emoji ON emoji_uses (emoji_key);

-- Resume point per channel for the overnight history backfill.
CREATE TABLE IF NOT EXISTS emoji_backfill (
    channel_id  TEXT PRIMARY KEY,
    before_id   TEXT,
    scanned     INTEGER NOT NULL DEFAULT 0,
    done        INTEGER NOT NULL DEFAULT 0
);

-- Game library: one row per copy someone owns. title_key is the normalized
-- title (lowercase, no accents or punctuation) used for matching.
CREATE TABLE IF NOT EXISTS games (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    title_key   TEXT NOT NULL,
    owner_id    TEXT NOT NULL,
    format      TEXT NOT NULL CHECK (format IN ('fisico', 'digital')),
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL,
    UNIQUE (owner_id, title_key, format)
);
CREATE INDEX IF NOT EXISTS games_title ON games (title_key);

-- Other names a title goes by ("totk", "lagrimas del reino"), shared by every
-- copy of that title. Both columns are normalized keys.
CREATE TABLE IF NOT EXISTS game_aliases (
    alias_key   TEXT PRIMARY KEY,
    title_key   TEXT NOT NULL
);

-- One row per loan of a physical copy; kept after the return as history.
-- returned_at NULL = still lent out, and a copy has at most one such loan.
CREATE TABLE IF NOT EXISTS game_loans (
    id           TEXT PRIMARY KEY,
    game_id      TEXT NOT NULL REFERENCES games(id),
    borrower_id  TEXT NOT NULL,
    lent_at      INTEGER NOT NULL,
    returned_at  INTEGER,
    note         TEXT,
    created_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS game_loans_open
    ON game_loans (game_id) WHERE returned_at IS NULL;

-- Betting. Balances are Cool Club Coins in cents: money_cents is spendable,
-- reserved_cents is locked in predictions on forecasts still ACTIVE.
CREATE TABLE IF NOT EXISTS gamblers (
    discord_id      TEXT PRIMARY KEY,
    display_name    TEXT NOT NULL,
    money_cents     INTEGER NOT NULL CHECK (money_cents >= 0),
    reserved_cents  INTEGER NOT NULL DEFAULT 0 CHECK (reserved_cents >= 0),
    created_at      INTEGER NOT NULL
);

-- id is the short "Gamble ID" users type. amount_cents is the default wager
-- of the SI/NO buttons.
CREATE TABLE IF NOT EXISTS forecasts (
    id            TEXT PRIMARY KEY,
    created_by    TEXT NOT NULL,
    description   TEXT NOT NULL,
    yes_odds      REAL NOT NULL CHECK (yes_odds > 0 AND yes_odds < 1),
    amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
    status        TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DONE')),
    outcome       TEXT CHECK (outcome IN ('yes', 'no')),
    created_at    INTEGER NOT NULL,
    ended_at      INTEGER
);

CREATE TABLE IF NOT EXISTS predictions (
    id            TEXT PRIMARY KEY,
    forecast_id   TEXT NOT NULL REFERENCES forecasts(id),
    discord_id    TEXT NOT NULL REFERENCES gamblers(discord_id),
    decision      TEXT NOT NULL CHECK (decision IN ('yes', 'no')),
    multiplier    REAL NOT NULL,
    amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
    status        TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DONE')),
    created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS predictions_forecast ON predictions (forecast_id);
CREATE INDEX IF NOT EXISTS predictions_user ON predictions (discord_id, status);
`

let db: DatabaseSync | null = null
export const getDb = (): DatabaseSync => {
    if (!db) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
        db = new DatabaseSync(DB_PATH)
        // busy_timeout: the backfill script and the bot write concurrently.
        db.exec(
            'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;'
        )
        db.exec(SCHEMA)
    }
    return db
}

/**
 * Run fn inside a transaction, rolling back if it throws. IMMEDIATE takes the
 * write lock up front (waiting out busy_timeout) so a read-then-write can't
 * fail with SQLITE_BUSY when the backfill script commits in between.
 */
export const transaction = <T>(fn: () => T): T => {
    const database = getDb()
    database.exec('BEGIN IMMEDIATE')
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
    // Write under a temp name so a kill mid-VACUUM never leaves a partial file
    // that looks like today's backup (and gets uploaded to the cloud).
    const tmp = `${file}.tmp`
    fs.rmSync(tmp, { force: true })
    getDb().exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`)
    fs.renameSync(tmp, file)

    const backups = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => /^rushmore-\d{4}-\d{2}-\d{2}\.db$/.test(f))
        .sort()
    backups
        .slice(0, Math.max(0, backups.length - BACKUPS_TO_KEEP))
        .forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)))
}
