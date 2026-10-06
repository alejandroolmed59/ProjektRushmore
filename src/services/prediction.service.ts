import { getDb, transaction } from '../database/sqlite'
import { Gambler, PredictionHistory } from '../interfaces/gambler.interface'
import { GenerateLongerId } from '../utils/id-generator'
import { formatCcc } from '../utils/money'
import { getGambler } from './money.service'

type PredictionRow = {
    id: string
    forecast_id: string
    discord_id: string
    decision: 'yes' | 'no'
    multiplier: number
    amount_cents: number
    status: 'ACTIVE' | 'DONE'
}

const rowToPrediction = (row: PredictionRow): PredictionHistory => ({
    predictionId: row.id,
    gambleId: row.forecast_id,
    discordId: row.discord_id,
    gambleDecision: row.decision,
    multiplier: row.multiplier,
    amountCents: row.amount_cents,
    status: row.status,
})

/**
 * Place a bet: move the stake from the gambler's spendable money to reserved
 * and record the prediction, atomically. Returns the updated gambler.
 */
export const createPredictionFromForecast = (
    gambleId: string,
    amountCents: number,
    discordId: string,
    multiplier: number,
    gambleDecision: 'yes' | 'no',
    now: number = Date.now()
): Gambler =>
    transaction(() => {
        // Checked here too: a stake on a DONE forecast would stay reserved forever.
        const forecast = getDb()
            .prepare('SELECT status FROM forecasts WHERE id = ?')
            .get(gambleId) as { status: string } | undefined
        if (forecast?.status !== 'ACTIVE')
            throw new Error(`gambleId: ${gambleId} not active`)
        const gambler = getGambler(discordId)
        if (!gambler)
            throw new Error('Gambler not found', { cause: { status: 2 } })
        if (gambler.moneyCents < amountCents)
            throw new Error('Not enough ccc, negative remaining money', {
                cause: {
                    status: 3,
                    disponible: formatCcc(gambler.moneyCents),
                },
            })
        getDb()
            .prepare(
                `INSERT INTO predictions (id, forecast_id, discord_id, decision, multiplier, amount_cents, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`
            )
            .run(
                GenerateLongerId(),
                gambleId,
                discordId,
                gambleDecision,
                multiplier,
                amountCents,
                now
            )
        getDb()
            .prepare(
                `UPDATE gamblers SET money_cents = money_cents - ?, reserved_cents = reserved_cents + ?
                WHERE discord_id = ?`
            )
            .run(amountCents, amountCents, discordId)
        return {
            ...gambler,
            moneyCents: gambler.moneyCents - amountCents,
            reservedCents: gambler.reservedCents + amountCents,
        }
    })

export const getPredictionsForForecast = (
    gambleId: string
): PredictionHistory[] =>
    (
        getDb()
            .prepare(
                'SELECT * FROM predictions WHERE forecast_id = ? ORDER BY created_at'
            )
            .all(gambleId) as PredictionRow[]
    ).map(rowToPrediction)

export const endPredictionsForForecast = (gambleId: string): void => {
    getDb()
        .prepare("UPDATE predictions SET status = 'DONE' WHERE forecast_id = ?")
        .run(gambleId)
}

export const getActivePredictionsByUser = (
    discordId: string
): PredictionHistory[] =>
    (
        getDb()
            .prepare(
                "SELECT * FROM predictions WHERE discord_id = ? AND status = 'ACTIVE' ORDER BY created_at"
            )
            .all(discordId) as PredictionRow[]
    ).map(rowToPrediction)
