import 'dotenv/config'

import { Client, GatewayIntentBits, Message, Interaction } from 'discord.js'
import { newMessageInChannel } from './handlers/new-message.handler'
import { newInteractionHandler } from './handlers/new-interaction.handler'

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
client.on('interactionCreate', (interaction: Interaction) => {
    newInteractionHandler(interaction)
})

client.login(process.env.TOKEN)
