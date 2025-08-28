import ddbClient from '../database/ddbclient.singleton'
import { DecisionHistory, Forecast } from '../interfaces/gambler.interface'
const gambleTable: string = process.env.GAMBLE_TABLE_NAME!
const gambleHistoryTable: string = process.env.GAMBLE_HISTORY_TABLE_NAME!
export const getForecast = async (gambleId: string): Promise<Forecast> => {
    try {
        const queryForecastResponse = await ddbClient.query(gambleTable, {
            gambleId,
        })
        if (queryForecastResponse.Items?.length !== 1)
            throw new Error(`Forecast ${gambleId} doesnt exist`)
        return queryForecastResponse.Items[0] as Forecast
    } catch (e) {
        console.log('error')
        throw e
    }
}
export const scanForecast = async (): Promise<Forecast[]> => {
    try {
        const queryForecastResponse = await ddbClient.scan(
            gambleTable,
            undefined,
            { status: 'ACTIVE' }
        )
        return queryForecastResponse.Items as Forecast[]
    } catch (e) {
        console.log('error')
        throw e
    }
}
export const createForecast = async (
    gambleId: string,
    createdByDiscordId: string,
    descripcion: string,
    yesOdds: number,
    amount: number
) => {
    try {
        const dataPayload: Forecast = {
            gambleId,
            createdBy: createdByDiscordId,
            descripcion,
            yesOdds,
            amount,
            status: 'ACTIVE',
        }
        const createCommand = await ddbClient.add(gambleTable, dataPayload)
        return createCommand.$metadata.httpStatusCode
    } catch (e) {
        console.log('error', e)
        throw e
    }
}
export const createPredictionFromForecast = async (
    forecast: Forecast,
    discordId: string,
    multiplier: number,
    gambleDecision: 'yes' | 'no'
) => {
    try {
        const dataPayload: DecisionHistory = {
            discordId,
            gambleId: forecast.gambleId,
            amountWagered: forecast.amount,
            gambleDecision,
            multiplier,
        }
        const createCommand = await ddbClient.add(
            gambleHistoryTable,
            dataPayload
        )
        return createCommand.$metadata.httpStatusCode
    } catch (e) {
        console.log('error', e)
        throw e
    }
}
