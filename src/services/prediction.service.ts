import { v4 as uuidv4 } from 'uuid'
import ddbClient from '../database/ddbclient.singleton'
import { PredictionHistory, Gambler } from '../interfaces/gambler.interface'

const predictionHistoryTable: string =
    process.env.PREDICTION_HISTORY_TABLE_NAME!
const moneyTable: string = process.env.GAMBLERS_MONEY_TABLE_NAME!

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
export const getPrectionsFromAForecast = async (gambleId: string) => {
    const getPredictionsCommand = await ddbClient.query(
        predictionHistoryTable,
        {
            gambleId,
        },
        undefined,
        undefined,
        'gambleId-index'
    )
    return getPredictionsCommand.Items as PredictionHistory[]
}
