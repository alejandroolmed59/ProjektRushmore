import {
    GamblerResult,
    PredictionHistory,
} from '../interfaces/gambler.interface'
import { endForecastStatus, getForecast } from './forecast.service'
import { getMoney, editGambler } from './money.service'
import {
    createPredictionFromForecast,
    endPredictionStatus,
    getPrectionsFromAForecast,
} from './prediction.service'

export const helperCreatePrediction = async (
    gambleId: string,
    discordId: string,
    decision: 'yes' | 'no',
    amount?: number
) => {
    const forecastDdb = await getForecast(gambleId)
    const proba =
        decision === 'yes'
            ? forecastDdb.yesOdds
            : decision === 'no'
              ? 1 - forecastDdb.yesOdds
              : 0
    if (proba === 0)
        throw new Error(`Invalid zero odds value gambleId: ${gambleId}`, {
            cause: { status: 1 },
        })
    const multiplier = Number((1 / proba).toFixed(2))
    const amountWagered = amount ?? forecastDdb.amount
    const response = await createPredictionFromForecast(
        gambleId,
        amountWagered,
        discordId,
        multiplier,
        decision
    )
    return {
        status: 0,
        ddbResponse: response,
        forecast: forecastDdb,
        odds: proba,
        multiplier,
        amountWagered,
    }
}

export const helperEndForecast = async (
    gambleId: string,
    finalOutcome: 'yes' | 'no'
) => {
    const forecastDdb = await getForecast(gambleId)
    if (forecastDdb.status === 'DONE')
        throw new Error(
            `Trying to end a forecast in status DONE, gambleId ${gambleId}`
        )
    const gamblersDdb = await getMoney()
    const predictions: PredictionHistory[] =
        await getPrectionsFromAForecast(gambleId)

    const results: Record<string, GamblerResult> = {}
    for (const prediction of predictions) {
        if (!results[prediction.discordId]) {
            const profile = gamblersDdb.find(
                (g) => g.discordId === prediction.discordId
            )
            if (!profile) {
                console.log(
                    `discordId ${prediction.discordId} no longer exists`
                )
                continue
            }
            results[prediction.discordId] = {
                discordId: prediction.discordId,
                profile,
                totalWon: 0,
                totalLost: 0,
                totalWageredForForecast: 0,
            }
        }
        results[prediction.discordId]!.totalWageredForForecast +=
            prediction.amountWagered
        if (prediction.gambleDecision === finalOutcome) {
            results[prediction.discordId]!.totalWon +=
                prediction.amountWagered * prediction.multiplier
        } else {
            results[prediction.discordId]!.totalLost += prediction.amountWagered
        }
    }
    const arrayResults = Object.values(results)
    for (const gambler of arrayResults) {
        try {
            // Only sum in the database if the amount is positive, the balance was previosly deducted
            const gambleResultsMoney = gambler.totalWon - gambler.totalLost
            const moneyAwared =
                gambleResultsMoney > 0
                    ? Number(
                          (gambler.profile.money + gambleResultsMoney).toFixed(
                              2
                          )
                      )
                    : gambler.profile.money
            const amountWagered = Number(
                (
                    gambler.profile.moneyReserved -
                    gambler.totalWageredForForecast
                ).toFixed(2)
            )
            await editGambler(gambler.discordId, {
                money: moneyAwared,
                moneyReserved: amountWagered,
            })
        } catch (e) {
            console.log(
                `Gamblers money ${gambler.discordId} could not be updated`
            )
        }
    }
    //End all predictions
    for (const prediction of predictions) {
        try {
            await endPredictionStatus(
                prediction.discordId,
                prediction.predictionId,
                {
                    status: 'DONE',
                }
            )
        } catch (e) {
            console.log(
                `Error updating prediction money ${prediction.predictionId} of gambler ${prediction.discordId}`
            )
        }
    }
    //End forecast
    await endForecastStatus(gambleId, { status: 'DONE' })
    return {
        forecast: forecastDdb,
        predictions,
        arrayResults,
        results,
    }
}
