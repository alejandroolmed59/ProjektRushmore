import { getDb } from '../database/sqlite'
import { Forecast } from '../interfaces/gambler.interface'

type ForecastRow = {
    id: string
    created_by: string
    description: string
    yes_odds: number
    amount_cents: number
    status: 'ACTIVE' | 'DONE'
}

const rowToForecast = (row: ForecastRow): Forecast => ({
    gambleId: row.id,
    createdBy: row.created_by,
    descripcion: row.description,
    yesOdds: row.yes_odds,
    amountCents: row.amount_cents,
    status: row.status,
})

export const getForecast = (gambleId: string): Forecast => {
    const row = getDb()
        .prepare('SELECT * FROM forecasts WHERE id = ?')
        .get(gambleId) as ForecastRow | undefined
    if (!row) throw new Error(`Forecast ${gambleId} doesnt exist`)
    return rowToForecast(row)
}

export const scanForecast = (): Forecast[] =>
    (
        getDb()
            .prepare(
                "SELECT * FROM forecasts WHERE status = 'ACTIVE' ORDER BY created_at"
            )
            .all() as ForecastRow[]
    ).map(rowToForecast)

export const createForecast = (
    gambleId: string,
    createdByDiscordId: string,
    descripcion: string,
    yesOdds: number,
    amountCents: number,
    now: number = Date.now()
): void => {
    getDb()
        .prepare(
            `INSERT INTO forecasts (id, created_by, description, yes_odds, amount_cents, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`
        )
        .run(
            gambleId,
            createdByDiscordId,
            descripcion,
            yesOdds,
            amountCents,
            now
        )
}

/** yesOddsInput is a percentage, 1-99. */
export const editForecast = (
    gambleId: string,
    yesOddsInput: number
): Forecast => {
    if (
        !Number.isInteger(yesOddsInput) ||
        yesOddsInput < 1 ||
        yesOddsInput > 99
    )
        throw new Error('La probabilidad debe estar entre 1 y 99')
    getForecast(gambleId)
    getDb()
        .prepare('UPDATE forecasts SET yes_odds = ? WHERE id = ?')
        .run(Number((yesOddsInput / 100).toFixed(2)), gambleId)
    return getForecast(gambleId)
}

export const endForecastStatus = (
    gambleId: string,
    outcome: 'yes' | 'no',
    now: number = Date.now()
): void => {
    getDb()
        .prepare(
            "UPDATE forecasts SET status = 'DONE', outcome = ?, ended_at = ? WHERE id = ?"
        )
        .run(outcome, now, gambleId)
}
