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
