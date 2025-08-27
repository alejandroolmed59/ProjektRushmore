import { Client, GatewayIntentBits, Message, EmbedBuilder } from 'discord.js'
import dotenv from 'dotenv'
import { newMessageInChannel } from './handlers/new-message.handler'
dotenv.config()

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
})

client.once('clientReady', () => {
    console.log(`✅ Logged in as ${client.user?.tag}`)
})

client.on('messageCreate', (message: Message) => {
    newMessageInChannel(message)
})

client.login(process.env.TOKEN)
