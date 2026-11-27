import {
    classifyPeneMessage,
    clearPeneMentions,
    deletePeneMentions,
    recordPeneMentions,
} from '../services/pene.service'
import { MessageScanner } from './types'

/** Counts penis references per message for /ranking-pene. */
export const peneScanner: MessageScanner = {
    name: 'pene',
    // Bump after changing the word lists or the Jev question.
    version: 1,
    async scan(message) {
        if (message.authorBot) return
        const result = await classifyPeneMessage(message.content)
        if (result.total > 0) recordPeneMentions(message, result)
        // An edit can remove every mention.
        else deletePeneMentions([message.id])
        // The clear words are saved; retry later for the ambiguous ones.
        if (result.jevFailed) throw new Error('Jev unavailable')
    },
    forget: deletePeneMentions,
    reset: clearPeneMentions,
}
