import { createHash } from 'crypto'
import { jevAnswer, JEV_ANSWER_SETTINGS } from '../components/typesafeClient'
import { getDb } from '../database/sqlite'

/**
 * jevAnswer, remembering answers in SQLite so rescanning the message archive
 * doesn't ask Jev the same question twice. The model and threshold are part
 * of the key, so changing either asks again. Errors (null) aren't cached, so
 * they're retried next time.
 */
export const cachedJevAnswer = async (
    tag: string,
    question: string,
    content: string
): Promise<boolean | null> => {
    const key = createHash('sha256')
        .update(`${tag}\0${question}\0${content}\0${JEV_ANSWER_SETTINGS}`)
        .digest('hex')
    const db = getDb()
    const hit = db
        .prepare('SELECT answer FROM jev_cache WHERE key = ?')
        .get(key) as { answer: number } | undefined
    if (hit) return hit.answer === 1

    const answer = await jevAnswer(tag, question, content)
    if (answer !== null)
        db.prepare(
            'INSERT OR REPLACE INTO jev_cache (key, answer, created_at) VALUES (?, ?, ?)'
        ).run(key, answer ? 1 : 0, Date.now())
    return answer
}
