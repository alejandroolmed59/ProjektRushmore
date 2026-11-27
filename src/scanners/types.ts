import { ArchivedMessage } from '../services/message-archive.service'

/**
 * Thrown by a scan when a service it needs (e.g. Jev) is down, as opposed to
 * the message itself being the problem. The runner stops the pass and tries
 * the same message again on later passes without counting tries, so an outage
 * doesn't make it skip messages. It gives up on a message only after a day.
 */
export class ScannerUnavailableError extends Error {}

/**
 * A feature that derives data from the message archive. The runner feeds it
 * every archived message in write order (history and live alike) and keeps a
 * bookmark, so a scanner only has to handle one message at a time.
 *
 * To add one: implement this, store results in your own table keyed by
 * message ID, and list it in SCANNERS (src/scanners/index.ts).
 */
export type MessageScanner = {
    /** Unique and stable: it keys the bookmark in scanner_state. */
    name: string
    /** Bump to wipe this scanner's data (reset) and rescan everything. */
    version: number
    /**
     * Process one message. An edited message comes through again, so
     * overwrite earlier results for the same ID (and remove them if the
     * message no longer matches). Throw to retry it on the next pass; after
     * 3 failed tries the runner skips the message. Throw
     * ScannerUnavailableError instead when a service the scan needs is down.
     */
    scan(message: ArchivedMessage): Promise<void>
    /** Drop results for messages deleted on Discord. */
    forget(messageIds: string[]): void
    /** Drop all results before a full rescan. */
    reset(): void
}
