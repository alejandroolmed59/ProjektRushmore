import { ArchivedMessage } from '../services/message-archive.service'

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
     * message no longer matches). Throw to retry it on the next pass.
     */
    scan(message: ArchivedMessage): Promise<void>
    /** Drop results for messages deleted on Discord. */
    forget(messageIds: string[]): void
    /** Drop all results before a full rescan. */
    reset(): void
}
