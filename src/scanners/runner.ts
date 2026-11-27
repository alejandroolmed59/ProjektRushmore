import { getDb, transaction } from '../database/sqlite'
import {
    ArchivedMessage,
    countMessagesAfterSeq,
    deleteArchivedMessages,
    isArchivedSeq,
    messagesAfterSeq,
} from '../services/message-archive.service'
import { SCANNERS } from '.'
import { MessageScanner, ScannerUnavailableError } from './types'

const BATCH_SIZE = 200
// A message whose scan keeps throwing is skipped after this many tries, so
// one bad message can't stall a scanner forever.
const MAX_ATTEMPTS = 3
// A message that keeps failing with ScannerUnavailableError is skipped after
// this long, so one the service can never answer can't stall a scanner either.
const UNAVAILABLE_GIVE_UP_MS = 24 * 60 * 60_000
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
// The message each scanner is stuck on while a service it needs is down, and
// since when.
const waiting = new Map<string, { seq: number; since: number }>()

/** After a failed scan: true to try the message again later, false to skip it. */
const retryLater = (
    scanner: MessageScanner,
    message: ArchivedMessage,
    e: unknown
): boolean => {
    if (e instanceof ScannerUnavailableError) {
        const wait = waiting.get(scanner.name)
        if (wait?.seq !== message.seq) {
            waiting.set(scanner.name, { seq: message.seq, since: Date.now() })
            console.log(
                `[scanners] ${scanner.name} waiting at ${message.id}: ${e.message}`
            )
            return true
        }
        if (Date.now() - wait.since < UNAVAILABLE_GIVE_UP_MS) return true
        console.log(
            `[scanners] ${scanner.name} skipping ${message.id}: still failing after a day`
        )
        return false
    }
    const key = `${scanner.name}:${message.seq}`
    const attempts = (failures.get(key) ?? 0) + 1
    if (attempts < MAX_ATTEMPTS) {
        failures.set(key, attempts)
        console.log(
            `[scanners] ${scanner.name} failed on ${message.id} (try ${attempts}), retrying later:`,
            e
        )
        return true
    }
    failures.delete(key)
    console.log(
        `[scanners] ${scanner.name} skipping ${message.id} after ${attempts} tries`
    )
    return false
}

/**
 * Scan one message. Returns false when the pass has to stop here and try the
 * same message again later.
 */
const scanMessage = async (
    scanner: MessageScanner,
    message: ArchivedMessage
): Promise<boolean> => {
    try {
        await scanner.scan(message)
    } catch (e) {
        if (retryLater(scanner, message, e)) return false
    } finally {
        // Deleted on Discord while the scan was waiting or while its batch
        // was in memory: forgetMessages ran before the scan stored its
        // result, so drop it now. An edit lands here too, harmlessly: its
        // new row is scanned later.
        if (!isArchivedSeq(message.seq)) scanner.forget([message.id])
    }
    waiting.delete(scanner.name)
    return true
}

const drainScanner = async (scanner: MessageScanner): Promise<void> => {
    let seq = loadSeq(scanner)
    for (;;) {
        const batch = messagesAfterSeq(seq, BATCH_SIZE)
        if (batch.length === 0) return
        let stopped = false
        for (const message of batch) {
            if (!(await scanMessage(scanner, message))) {
                stopped = true
                break
            }
            seq = message.seq
        }
        // One write per batch, not per message: a crash replays at most one
        // batch, and scans overwrite their results by message ID.
        saveSeq(scanner.name, seq)
        if (stopped) return
        // A scan that needs no network call never yields, so without this a
        // full rescan would hold the event loop (commands, reminders, the
        // gateway heartbeat) until the whole archive is read.
        await new Promise((resolve) => setImmediate(resolve))
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
