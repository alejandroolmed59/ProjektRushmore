import { v4 as uuidv4 } from 'uuid'
import ddbClient from '../database/ddbclient.singleton'
import {
    ForecastHistory,
    Forecast,
    Gambler,
} from '../interfaces/gambler.interface'
const gambleTable: string = process.env.GAMBLE_TABLE_NAME!
const forecastHistoryTable: string = process.env.FORECAST_HISTORY_TABLE_NAME!
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
export const createPredictionFromForecast = async (
    gambleId: string,
    amountWagered: number,
    discordId: string,
    multiplier: number,
    gambleDecision: 'yes' | 'no'
): Promise<{ status: number; message: string; ctx: Record<string, any> }> => {
    try {
        const getGamblerCommand = await ddbClient.query(moneyTable, {
            discordId,
        })
        const gamblerItem = getGamblerCommand.Items?.at(0) as
            | Gambler
            | undefined
        if (!gamblerItem)
            return {
                status: 1,
                message: 'Gambler not found',
                ctx: { discordId },
            }
        const remainingMoney = gamblerItem.money - amountWagered
        const totalReserved = gamblerItem.moneyReserved + amountWagered
        if (remainingMoney < 0)
            return {
                status: 1,
                message: 'Not enough money',
                ctx: {
                    discordId,
                    currentMoney: gamblerItem.money,
                    remainingMoney,
                },
            }
        const dataPayload: ForecastHistory = {
            discordId,
            forecastId: uuidv4(),
            gambleId,
            amountWagered,
            gambleDecision,
            multiplier,
        }
        //Create forecast table
        const createForecastCommand = await ddbClient.add(
            forecastHistoryTable,
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
            ctx: { createForecastCommand, updateGamblerCommand },
        }
    } catch (e) {
        console.log('error', e)
        return { status: 1, message: String(e), ctx: {} }
    }
}
