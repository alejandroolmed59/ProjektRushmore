import ddbClient from '../database/ddbclient.singleton'
import { Gambler } from '../interfaces/gambler.interface'
const moneyTable: string = process.env.GAMBLERS_MONEY_TABLE_NAME!
export const getMoney = async () => {
    try {
        const fetchUsersMoney = (await ddbClient.scan(moneyTable)).Items
        return fetchUsersMoney
    } catch (e) {
        console.log('error')
        throw e
    }
}
export const createNewGambler = async (discordId: string) => {
    try {
        const dataPayload: Gambler = { discordId, money: 500 }
        const createCommand = await ddbClient.add(moneyTable, dataPayload)
        console.log(createCommand)
        return true
    } catch (e) {
        console.log('error', e)
        return false
    }
}
