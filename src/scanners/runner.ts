import { getDb, transaction } from '../database/sqlite'
import {
    countMessagesAfterSeq,
    deleteArchivedMessages,
    messagesAfterSeq,
} from '../services/message-archive.service'
import { SCANNERS } from '.'
import { MessageScanner } from './types'

const BATCH_SIZE = 200
// A message whose scan keeps throwing is skipped after this many tries, so
// one bad message can't stall a scanner forever.
const MAX_ATTEMPTS = 3
// Picks up rows the backfill script writes from its own process.
const POLL_INTERVAL_MS = 60_000

/** Bookmark for a scanner, resetting its data first if its version changed. */
const loadSeq = (scanner: MessageScanner): number => {
    const db = getDb()
    const row = db
        .prepare('SELECT version, last_seq FROM scanner_state WHERE name = ?')
        .get(scanner.name) as { version: number; last_seq: number } | undefined
    if (row && row.version === scanner.version) return row.last_seq
    transaction(() => {
        scanner.reset()
        db.prepare(
            `INSERT INTO scanner_state (name, version, last_seq) VALUES (?, ?, 0)
             ON CONFLICT (name) DO UPDATE SET version = excluded.version, last_seq = 0`
        ).run(scanner.name, scanner.version)
    })
    console.log(`[scanners] ${scanner.name} v${scanner.version}: full rescan`)
    return 0
}

const saveSeq = (name: string, seq: number): void => {
    getDb()
        .prepare('UPDATE scanner_state SET last_seq = ? WHERE name = ?')
        .run(seq, name)
}

const failures = new Map<string, number>()

const drainScanner = async (scanner: MessageScanner): Promise<void> => {
    let seq = loadSeq(scanner)
    for (;;) {
        const batch = messagesAfterSeq(seq, BATCH_SIZE)
        if (batch.length === 0) return
        for (const message of batch) {
            try {
                await scanner.scan(message)
            } catch (e) {
                const key = `${scanner.name}:${message.seq}`
                const attempts = (failures.get(key) ?? 0) + 1
                if (attempts < MAX_ATTEMPTS) {
                    failures.set(key, attempts)
                    console.log(
                        `[scanners] ${scanner.name} failed on ${message.id} (try ${attempts}), retrying later:`,
                        e
                    )
                    return
                }
                failures.delete(key)
                console.log(
                    `[scanners] ${scanner.name} skipping ${message.id} after ${attempts} tries`
                )
            }
            seq = message.seq
            saveSeq(scanner.name, seq)
        }
    }
}

let draining: Promise<void> | null = null
let drainAgain = false

/**
 * Run every scanner over the messages it hasn't seen yet. Only one pass runs
 * at a time; a call during a pass schedules one more pass after it.
 */
export const drainScanners = (): Promise<void> => {
    if (draining) {
        drainAgain = true
        return draining
    }
    draining = (async () => {
        do {
            drainAgain = false
            for (const scanner of SCANNERS) {
                try {
                    await drainScanner(scanner)
                } catch (e) {
                    console.log(`[scanners] ${scanner.name} pass failed:`, e)
                }
            }
        } while (drainAgain)
    })().finally(() => {
        draining = null
    })
    return draining
}

/** Delete messages from the archive and every scanner's results. */
export const forgetMessages = (ids: string[]): void => {
    if (ids.length === 0) return
    transaction(() => {
        deleteArchivedMessages(ids)
        for (const scanner of SCANNERS) scanner.forget(ids)
    })
}

/** Archived messages a scanner hasn't read yet (e.g. during a backfill). */
export const scannerBacklog = (name: string): number => {
    const row = getDb()
        .prepare('SELECT last_seq FROM scanner_state WHERE name = ?')
        .get(name) as { last_seq: number } | undefined
    return countMessagesAfterSeq(row?.last_seq ?? 0)
}

export const startScanners = (): void => {
    void drainScanners()
    setInterval(() => void drainScanners(), POLL_INTERVAL_MS)
}
