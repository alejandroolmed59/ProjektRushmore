import { Message, EmbedBuilder } from 'discord.js'
import { createNewGambler, getMoney } from '../handlers/money.handler'
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
        const embed = new EmbedBuilder()
            .setTitle('Dineros')
            .setDescription('Balance de teclennios')
            .addFields([])
            .setColor(0x5865f2)

        message.reply({ embeds: [embed] })
    }
    if (message.content === '!cajero') {
        const gamblerCreateResponse = await createNewGambler(message.author.id)
        if (gamblerCreateResponse) {
            message.reply('Nuevo gambler creado!')
        } else {
            message.reply('gambler ya tiene mony')
        }
    }
}
