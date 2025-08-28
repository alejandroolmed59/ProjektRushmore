import ddbClient from '../database/ddbclient.singleton'
import { Gambler } from '../interfaces/gambler.interface'
const moneyTable: string = process.env.GAMBLERS_MONEY_TABLE_NAME!

export const getMoney = async (): Promise<Gambler[]> => {
    try {
        const fetchUsersMoneyCommand = await ddbClient.scan(moneyTable)
        console.log(fetchUsersMoneyCommand)
        return fetchUsersMoneyCommand.Items as Gambler[]
    } catch (e) {
        console.log('error')
        throw e
    }
}
export const createNewGambler = async (
    discordId: string,
    displayName: string
) => {
    try {
        const dataPayload: Gambler = {
            discordId,
            displayName,
            money: 600,
            moneyReserved: 0,
        }
        const createCommand = await ddbClient.add(moneyTable, dataPayload)
        console.log(createCommand)
        return createCommand.$metadata.httpStatusCode
    } catch (e) {
        console.log('error', e)
        throw e
    }
}
