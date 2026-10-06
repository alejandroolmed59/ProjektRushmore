import { Message, EmbedBuilder, Colors } from 'discord.js'
import { createNewGambler, getMoney } from '../services/money.service'
import { maybeRelocateFootballMessage } from '../services/message-relocator.service'
import { maybeReactToShitpost } from '../services/shitpost-detector.service'
import os from 'os'

export const newMessageInChannel = async (message: Message): Promise<void> => {
    if (message.author.bot) return // ignore bots

    // Relocate the watched user's football/soccer posts out of the channel.
    if (await maybeRelocateFootballMessage(message)) return
    void maybeReactToShitpost(message)

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
