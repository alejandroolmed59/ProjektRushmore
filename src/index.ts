import 'dotenv/config'

import {
    Client,
    GatewayIntentBits,
    Partials,
    Message,
    Interaction,
} from 'discord.js'
import { newMessageInChannel } from './handlers/new-message.handler'
import { newInteractionHandler } from './handlers/new-interaction.handler'
import { maybeRelocateFootballByReaction } from './services/message-relocator.service'

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    // Reactions usually land on messages posted before the bot started (not
    // cached), so we must opt into partials to receive those events.
    partials: [Partials.Message, Partials.Reaction],
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
client.on('messageReactionAdd', (reaction) => {
    maybeRelocateFootballByReaction(reaction)
})

client.login(process.env.TOKEN)
