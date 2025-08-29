import ddbClient from '../database/ddbclient.singleton'
import { Gambler } from '../interfaces/gambler.interface'
const moneyTable: string = process.env.GAMBLERS_MONEY_TABLE_NAME!

export const getMoney = async (): Promise<Gambler[]> => {
    try {
        const fetchUsersMoneyCommand = await ddbClient.scan(moneyTable)
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
        const readGamblerCommand = await ddbClient.query(moneyTable, {
            discordId,
        })
        const existingUser = readGamblerCommand.Items?.at(0) as
            | Gambler
            | undefined
        if (existingUser) {
            if (existingUser.money + existingUser.moneyReserved > 100) {
                return {
                    action: 'Gambler tiene mas de 100 CCC, nada por hacer',
                }
            } else {
                await ddbClient.update<Gambler>(
                    moneyTable,
                    { discordId },
                    {
                        money: 250,
                    }
                )
                return {
                    action: 'Sacando 250$ CCC de la cuenta del banco para las apuestas 🤑',
                }
            }
        }
        const dataPayload: Gambler = {
            discordId,
            displayName,
            money: 1000,
            moneyReserved: 0,
        }
        const createCommand = await ddbClient.add(moneyTable, dataPayload)
        return {
            action: 'Hoy nacio un apostador exitoso 🤠, ten tus primeros 1000 CCC, aprovechalos y multiplicalos',
        }
    } catch (e) {
        console.log('error', e)
        throw e
    }
}
export const editGambler = async (
    discordId: string,
    payload: Partial<Pick<Gambler, 'displayName' | 'money' | 'moneyReserved'>>
) => {
    try {
        const createCommand = await ddbClient.update<Gambler>(
            moneyTable,
            { discordId },
            payload,
            undefined,
            'ALL_NEW'
        )
        return createCommand.$metadata.httpStatusCode
    } catch (e) {
        console.log('error', e)
        throw e
    }
}
