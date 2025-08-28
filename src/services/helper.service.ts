import { createPredictionFromForecast, getForecast } from './forecast.service'

export const helperCreateForecast = async (
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
        throw new Error(`Invalid zero odds value gambleId: ${gambleId}`)
    const multiplier = Number((1 / proba).toFixed(2))
    const amountWagered = amount ?? forecastDdb.amount
    const response = await createPredictionFromForecast(
        gambleId,
        amountWagered,
        discordId,
        multiplier,
        decision
    )
    if (response.status !== 0) return { status: 1 }
    return {
        status: 0,
        ddbResponse: response,
        forecast: forecastDdb,
        odds: proba,
        multiplier,
        amountWagered,
    }
}
