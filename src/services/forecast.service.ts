import ddbClient from '../database/ddbclient.singleton'
import { Forecast } from '../interfaces/gambler.interface'
const gambleTable: string = process.env.GAMBLE_TABLE_NAME!
/*
export const getMoney = async (): Promise<yesOdds[]> => {
    try {
        const fetchUsersMoneyCommand = await ddbClient.scan(moneyTable)
        console.log(fetchUsersMoneyCommand)
        return fetchUsersMoneyCommand.Items as Gambler[]
    } catch (e) {
        console.log('error')
        throw e
    }
}*/
export const createForecast = async (
    gambleId: string,
    createdByDiscordId: string,
    yesOdds: number
) => {
    try {
        const dataPayload: Forecast = {
            gambleId,
            createdBy: createdByDiscordId,
            yesOdds,
        }
        const createCommand = await ddbClient.add(gambleTable, dataPayload)
        console.log(createCommand)
        return createCommand.$metadata.httpStatusCode
    } catch (e) {
        console.log('error', e)
        throw e
    }
}
