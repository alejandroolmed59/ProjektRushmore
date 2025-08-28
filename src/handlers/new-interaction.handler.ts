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
} from '../services/forecast.service'
import {
    newGambleEmbedBuilder,
    allBetsEmbedBuilder,
} from '../embeds/gamble.embed'
import { helperCreateForecast } from '../services/helper.service'
import { Gambler } from '../interfaces/gambler.interface'

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
                const embedPolymarket = allBetsEmbedBuilder(allGambles)
                await interaction.reply({
                    embeds: [embedPolymarket],
                })
                break
            case 'prediccion':
                const gambleIdInput =
                    interaction.options.getString('gamble-id')!
                const forecastInput = interaction.options.getString(
                    'forecast-decision'
                ) as 'yes' | 'no'
                const amountInput =
                    interaction.options.getNumber('monto-apuesta')!
                try {
                    const helperResponse = await helperCreateForecast(
                        gambleIdInput,
                        interaction.user.id,
                        forecastInput,
                        amountInput
                    )
                    const gamblerData = helperResponse.ddbResponse?.ctx
                        .updateGamblerCommand.Attributes as Gambler
                    const forecastData = helperResponse.forecast
                    const embedForecast = newGambleEmbedBuilder(
                        forecastData,
                        gamblerData,
                        forecastInput,
                        interaction.user.displayName,
                        helperResponse.multiplier
                    )

                    await interaction.reply({
                        embeds: [embedForecast],
                    })
                } catch (e) {
                    if (e instanceof Error) {
                        const errorMessage = e.message
                        const cause = e.cause
                        await interaction.reply(
                            `Error creando forecast. ${errorMessage}, ${String(cause)}`
                        )
                        return
                    }
                    await interaction.reply('Error creando forecast')
                }
                break
            default:
                await interaction.reply('Comando desconocido')
                break
        }
    }
    // RESPUESTAS MODAL
    if (interaction.isModalSubmit()) {
        console.log(`Interaccion del comando: ${interaction.customId}`)
        if (interaction.customId === 'modalApuesta') {
            const respuesta = gamblingModalSubmission(interaction)
            // Send the message with embed and buttons
            await interaction.reply({
                embeds: respuesta.modal.embed,
                components: respuesta.modal.component,
            })
            //create ddb record para el forecast
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
    // DESPUES DEL SLASH COMMAND
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
    // BUTTON PRESSED
    if (interaction.isButton()) {
        const interactionContext = interaction.customId.split('-')
        const gambleDecision = interactionContext[0] as 'yes' | 'no'
        const gambleId = interactionContext[2]
        if (!gambleDecision || !gambleId)
            throw new Error(
                `Error when creating users bet, gambleId ${gambleId}, decision ${gambleDecision} `
            )
        try {
            const helperResponse = await helperCreateForecast(
                gambleId,
                interaction.user.id,
                gambleDecision
            )

            const gamblerData = helperResponse.ddbResponse?.ctx
                .updateGamblerCommand.Attributes as Gambler
            const forecastData = helperResponse.forecast
            const embedRes = newGambleEmbedBuilder(
                forecastData,
                gamblerData,
                gambleDecision,
                interaction.user.displayName,
                helperResponse.multiplier
            )

            await interaction.reply({
                embeds: [embedRes],
            })
        } catch (e) {
            if (e instanceof Error) {
                const errorMessage = e.message
                const cause = e.cause
                await interaction.reply(
                    `Error creando forecast. ${errorMessage}, ${String(cause)}`
                )
            }
            await interaction.reply('Error creando forecast')
        }
    }
}
