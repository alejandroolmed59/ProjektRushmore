import { getDb, transaction } from '../database/sqlite'
import { Gambler, PredictionHistory } from '../interfaces/gambler.interface'
import { GenerateLongerId } from '../utils/id-generator'
import { formatCcc } from '../utils/money'
import { getGambler, registerGambler } from './money.service'
import { UserError } from '../utils/user-error'

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
 * and record the prediction, atomically. Someone betting for the first time is
 * registered with the starting balance, the same as !cajero, and stays
 * registered even if this bet is rejected.
 * Returns the updated gambler and whether they were just registered.
 */
export const createPredictionFromForecast = (
    gambleId: string,
    amountCents: number,
    discordId: string,
    displayName: string,
    multiplier: number,
    gambleDecision: 'yes' | 'no',
    now: number = Date.now()
): { gambler: Gambler; registered: boolean } => {
    // Registered in its own step, before the transaction, so a rejected bet
    // doesn't roll the new account back.
    const existing = getGambler(discordId)
    const gambler = existing ?? registerGambler(discordId, displayName, now)
    return transaction(() => {
        // Checked here too: a stake on a DONE forecast would stay reserved forever.
        const forecast = getDb()
            .prepare('SELECT status FROM forecasts WHERE id = ?')
            .get(gambleId) as { status: string } | undefined
        if (forecast?.status !== 'ACTIVE')
            throw new UserError(`gambleId: ${gambleId} not active`)
        if (gambler.moneyCents < amountCents)
            throw new UserError('Not enough ccc, negative remaining money', {
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
            gambler: {
                ...gambler,
                moneyCents: gambler.moneyCents - amountCents,
                reservedCents: gambler.reservedCents + amountCents,
            },
            registered: !existing,
        }
    })
}

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
