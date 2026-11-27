import { peneScanner } from './pene.scanner'
import { MessageScanner } from './types'

/** Every feature that reads the message archive. */
export const SCANNERS: MessageScanner[] = [peneScanner]
