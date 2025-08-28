import { Interaction } from 'discord.js'
import {
    gamblingModalSubmission,
    gamblingModalBuilder,
    selectEndDateMenu,
} from '../modals/gambling.modal'
import {
    createForecast,
    getForecast,
    scanForecast,
    createPredictionFromForecast,
} from '../services/forecast.service'
import {
    newGambleEmbedBuilder,
    allBetsEmbedBuilder,
} from '../embeds/gamble.embed'

export const newInteractionHandler = async (
    interaction: Interaction
): Promise<void> => {
    //COMANDOS
    if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
            case 'polymarket':
                // Select menu
                const endDateSelected = selectEndDateMenu()
                await interaction.reply(endDateSelected)
                break
            case 'apuestas':
                const allGambles = await scanForecast()
                const embedRes = allBetsEmbedBuilder(allGambles)
                await interaction.reply({
                    embeds: [embedRes],
                })
                break
            default:
                0
        }
    }
    // RESPUESTAS
    if (interaction.isModalSubmit()) {
        console.log(`Interaccion del comando: ${interaction.customId}`)
        if (interaction.customId === 'modalApuesta') {
            const respuesta = gamblingModalSubmission(interaction)
            // Send the message with embed and buttons
            await interaction.reply({
                embeds: respuesta.modal.embed,
                components: respuesta.modal.component,
            })
            //create ddb record
            const ddbResponseForecast = await createForecast(
                interaction.id,
                interaction.user.id,
                respuesta.context.descripcion,
                respuesta.context.yesOdds,
                respuesta.context.amount
            )
            console.log(ddbResponseForecast)
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'endDateApuesta') {
            const endDateResponse = interaction.values[0]
            if (!endDateResponse)
                throw new Error(
                    'End Date no especificada en el string select menu'
                )
            const gamblingModal = gamblingModalBuilder(endDateResponse)
            await interaction.showModal(gamblingModal)
        }
    }
    // button confirmado
    if (interaction.isButton()) {
        const interactionContext = interaction.customId.split('-')
        const gambleDecision = interactionContext[0] as 'yes' | 'no'
        const gambleId = interactionContext[2]
        if (!gambleDecision || !gambleId)
            throw new Error(
                `Error when creating users bet, gambleId ${gambleId}, decision ${gambleDecision} `
            )
        const forecastDdb = await getForecast(gambleId)
        const proba =
            gambleDecision === 'yes'
                ? forecastDdb.yesOdds
                : 1 - forecastDdb.yesOdds
        const multiplier = Number((1 / proba).toFixed(2))
        const embedRes = newGambleEmbedBuilder(
            forecastDdb,
            gambleDecision,
            interaction.user.displayName,
            multiplier
        )
        await createPredictionFromForecast(
            forecastDdb,
            interaction.user.id,
            multiplier,
            gambleDecision
        )
        await interaction.reply({
            embeds: [embedRes],
        })
    }
}
