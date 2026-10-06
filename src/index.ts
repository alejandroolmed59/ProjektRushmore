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
import { newReactionHandler } from './handlers/new-reaction.handler'
import { startReminderScheduler } from './services/reminder-scheduler.service'
import {
    trackMessageEmojis,
    trackReactionRemove,
} from './handlers/emoji.handler'

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    // Reactions usually land on messages posted before the bot started (not
    // cached), so we must opt into partials to receive those events. User
    // partials let reaction events through even when the reactor isn't cached.
    partials: [Partials.Message, Partials.Reaction, Partials.User],
})
client.once('clientReady', () => {
    console.log(`✅ Logged in as ${client.user?.tag} !`)
    startReminderScheduler(client)
})

client.on('messageCreate', (message: Message) => {
    newMessageInChannel(message)
    trackMessageEmojis(message)
})
client.on('interactionCreate', (interaction: Interaction) => {
    // An uncaught rejection here would crash the bot.
    newInteractionHandler(interaction).catch((e) =>
        console.log('[interactions] unhandled error:', e)
    )
})
client.on('messageReactionAdd', (reaction, user) => {
    void newReactionHandler(reaction, user)
})
client.on('messageReactionRemove', (reaction, user) => {
    trackReactionRemove(reaction, user)
})

client.login(process.env.TOKEN)
