import { v4 as uuidv4 } from 'uuid'
import ddbClient from '../database/ddbclient.singleton'
import {
    PredictionHistory,
    Forecast,
    Gambler,
} from '../interfaces/gambler.interface'
const gambleTable: string = process.env.GAMBLE_TABLE_NAME!
const predictionHistoryTable: string =
    process.env.PREDICTION_HISTORY_TABLE_NAME!
const moneyTable: string = process.env.GAMBLERS_MONEY_TABLE_NAME!
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
export const editForecast = async (gambleId: string, yesOddsInput: number) => {
    try {
        const probabilidadApuestaInput = Number(yesOddsInput) / 100
        const yesOdds: number = Number(probabilidadApuestaInput.toFixed(2))
        const dataPayload: Pick<Forecast, 'yesOdds'> = {
            yesOdds,
        }
        const createCommand = await ddbClient.update<Forecast>(
            gambleTable,
            { gambleId },
            dataPayload,
            undefined,
            'ALL_NEW'
        )
        return createCommand.Attributes as Forecast
    } catch (e) {
        console.log('Edit forecast error', e)
        throw e
    }
}
export const createPredictionFromForecast = async (
    gambleId: string,
    amountWagered: number,
    discordId: string,
    multiplier: number,
    gambleDecision: 'yes' | 'no'
): Promise<{ status: number; message: string; ctx: Record<string, any> }> => {
    const getGamblerCommand = await ddbClient.query(moneyTable, {
        discordId,
    })
    const gamblerItem = getGamblerCommand.Items?.at(0) as Gambler | undefined
    if (!gamblerItem)
        throw new Error('Gambler not found', { cause: { status: 2 } })
    const remainingMoney = gamblerItem.money - amountWagered
    const totalReserved = gamblerItem.moneyReserved + amountWagered
    if (remainingMoney < 0)
        throw new Error('Not enough ccc, negative remaining money', {
            cause: { status: 3 },
        })
    const dataPayload: PredictionHistory = {
        discordId,
        predictionId: uuidv4(),
        gambleId,
        amountWagered,
        gambleDecision,
        multiplier,
    }
    //Create forecast table
    const createPredictionCommand = await ddbClient.add(
        predictionHistoryTable,
        dataPayload
    )
    const updateGamblerCommand = await ddbClient.update<Gambler>(
        moneyTable,
        { discordId },
        { money: remainingMoney, moneyReserved: totalReserved },
        undefined,
        'ALL_NEW'
    )
    // Update gamblers table
    return {
        status: 0,
        message: 'success',
        ctx: { createPredictionCommand, updateGamblerCommand },
    }
}
