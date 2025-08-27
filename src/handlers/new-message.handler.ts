import { Message, EmbedBuilder } from 'discord.js'
import { Gambler } from '../interfaces/gambler.interface'
import os from 'os'

const gamblers: Gambler[] = [
    {
        name: 'olme59',
        value: '500',
    },
    {
        name: 'zork',
        value: '500',
    },
]

export const newMessageInChannel = (message: Message): void => {
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
            .addFields([...gamblers])
            .setColor(0x5865f2)

        message.reply({ embeds: [embed] })
    }
    if (message.content === '!cajero') {
        const gamblerExisting = gamblers.find((gambler) => {
            return gambler.name === message.author.id
        })
        if (!gamblerExisting) {
            gamblers.push({ name: message.author.id, value: '500' })
            message.reply('Nuevo gambler creado!')
        } else {
            message.reply('gambler ya tiene mony')
        }
    }
}
