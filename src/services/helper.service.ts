import { getDb, transaction } from '../database/sqlite'
import {
    Forecast,
    Gambler,
    GamblerResult,
    PredictionHistory,
} from '../interfaces/gambler.interface'
import { endForecastStatus, getForecast } from './forecast.service'
import { getMoney } from './money.service'
import {
    createPredictionFromForecast,
    endPredictionsForForecast,
    getPredictionsForForecast,
} from './prediction.service'

/** amountCents defaults to the forecast's wager (the SI/NO buttons). */
export const helperCreatePrediction = (
    gambleId: string,
    discordId: string,
    decision: 'yes' | 'no',
    amountCents?: number
): {
    gambler: Gambler
    forecast: Forecast
    odds: number
    multiplier: number
    amountCents: number
} => {
    const forecast = getForecast(gambleId)
    const wager = amountCents ?? forecast.amountCents
    if (forecast.status !== 'ACTIVE')
        throw new Error(`gambleId: ${gambleId} not active`, {
            cause: { forecastStatus: forecast.status },
        })
    if (!Number.isInteger(wager) || wager <= 0)
        throw new Error(`Invalid wagered amount ${wager / 100}`)
    const proba = decision === 'yes' ? forecast.yesOdds : 1 - forecast.yesOdds
    if (proba <= 0)
        throw new Error(`Invalid zero odds value gambleId: ${gambleId}`, {
            cause: { status: 1 },
        })
    const multiplier = Number((1 / proba).toFixed(2))

    const gambler = createPredictionFromForecast(
        gambleId,
        wager,
        discordId,
        multiplier,
        decision
    )
    return { gambler, forecast, odds: proba, multiplier, amountCents: wager }
}

/**
 * Settle a forecast in one transaction. Stakes were already taken from
 * money_cents when the bets were placed, so each gambler gets back stake x
 * multiplier for their winning predictions, and every stake leaves reserved.
 */
export const helperEndForecast = (
    gambleId: string,
    finalOutcome: 'yes' | 'no'
): {
    forecast: Forecast
    predictions: PredictionHistory[]
    arrayResults: GamblerResult[]
    results: Record<string, GamblerResult>
} =>
    transaction(() => {
        const forecast = getForecast(gambleId)
        if (forecast.status === 'DONE')
            throw new Error(
                `Trying to end a forecast in status DONE, gambleId ${gambleId}`
            )
        const gamblers = getMoney()
        const predictions = getPredictionsForForecast(gambleId)

        const results: Record<string, GamblerResult> = {}
        for (const prediction of predictions) {
            let result = results[prediction.discordId]
            if (!result) {
                const profile = gamblers.find(
                    (g) => g.discordId === prediction.discordId
                )
                // Can't settle someone we can't pay: abort the whole settlement.
                if (!profile)
                    throw new Error(
                        `Gambler ${prediction.discordId} not found, forecast not ended`
                    )
                result = {
                    discordId: prediction.discordId,
                    profile,
                    payoutCents: 0,
                    wageredCents: 0,
                }
                results[prediction.discordId] = result
            }
            result.wageredCents += prediction.amountCents
            if (prediction.gambleDecision === finalOutcome)
                result.payoutCents += Math.round(
                    prediction.amountCents * prediction.multiplier
                )
        }

        const settle = getDb().prepare(
            `UPDATE gamblers SET money_cents = money_cents + ?, reserved_cents = reserved_cents - ?
            WHERE discord_id = ?`
        )
        const arrayResults = Object.values(results)
        for (const result of arrayResults)
            settle.run(
                result.payoutCents,
                result.wageredCents,
                result.discordId
            )
        endPredictionsForForecast(gambleId)
        endForecastStatus(gambleId, finalOutcome)
        return { forecast, predictions, arrayResults, results }
    })
