import { Message, EmbedBuilder, Colors } from 'discord.js'
import { createNewGambler, getMoney } from '../services/money.service'
import os from 'os'

export const newMessageInChannel = async (message: Message): Promise<void> => {
    if (message.author.bot) return // ignore bots
    if (message.content === '!ping') {
        message.reply(
            `Pong!, estoy corriendo en ${os.release()} , ${
                os.hostname
            }, memoria libre: ${os.freemem() / 1024 / 1024} MB`
        )
    }
    if (message.content === '!money') {
        try {
            const getMoneyResponse = await getMoney()
            const moneyMapped: {
                name: string
                value: string
                inline: boolean
            }[] = getMoneyResponse?.map((gambler) => {
                return {
                    name: gambler.displayName,
                    value: Number(gambler.money).toFixed(2),
                    inline: false,
                }
            })
            const embed = new EmbedBuilder()
                .setTitle('Dineros')
                .setDescription('Balance de gamblers 💸')
                .addFields(moneyMapped)
                .setColor(Colors.DarkGreen)

            message.reply({ embeds: [embed] })
        } catch (e) {
            message.reply(String(e))
        }
    }
    if (message.content === '!cajero') {
        try {
            const gamblerCreateResponse = await createNewGambler(
                message.author.id,
                message.author.displayName
            )
            message.reply(gamblerCreateResponse.action)
        } catch (e) {
            message.reply(String(e))
        }
    }
}
