import { getDb } from '../database/sqlite'
import { Gambler } from '../interfaces/gambler.interface'

const STARTING_CENTS = 100000
const REFILL_CENTS = 25000
// A gambler whose total (spendable + reserved) is at or below this can refill.
const REFILL_LIMIT_CENTS = 10000

type GamblerRow = {
    discord_id: string
    display_name: string
    money_cents: number
    reserved_cents: number
}

export const rowToGambler = (row: GamblerRow): Gambler => ({
    discordId: row.discord_id,
    displayName: row.display_name,
    moneyCents: row.money_cents,
    reservedCents: row.reserved_cents,
})

export const getGambler = (discordId: string): Gambler | undefined => {
    const row = getDb()
        .prepare('SELECT * FROM gamblers WHERE discord_id = ?')
        .get(discordId) as GamblerRow | undefined
    return row && rowToGambler(row)
}

export const getMoney = (): Gambler[] =>
    (getDb().prepare('SELECT * FROM gamblers').all() as GamblerRow[]).map(
        rowToGambler
    )

/** !cajero: register a new gambler, or refill one who is nearly broke. */
export const createNewGambler = (
    discordId: string,
    displayName: string,
    now: number = Date.now()
): { action: string } => {
    const existing = getGambler(discordId)
    if (existing) {
        if (existing.moneyCents + existing.reservedCents > REFILL_LIMIT_CENTS)
            return { action: 'Gambler tiene mas de 100 CCC, nada por hacer' }
        getDb()
            .prepare(
                'UPDATE gamblers SET money_cents = ?, display_name = ? WHERE discord_id = ?'
            )
            .run(REFILL_CENTS, displayName, discordId)
        return {
            action: 'Sacando 250$ CCC de la cuenta del banco para las apuestas 🤑',
        }
    }
    getDb()
        .prepare(
            `INSERT INTO gamblers (discord_id, display_name, money_cents, reserved_cents, created_at)
            VALUES (?, ?, ?, 0, ?)`
        )
        .run(discordId, displayName, STARTING_CENTS, now)
    return {
        action: 'Hoy nacio un apostador exitoso 🤠, ten tus primeros 1000 CCC, aprovechalos y multiplicalos',
    }
}
