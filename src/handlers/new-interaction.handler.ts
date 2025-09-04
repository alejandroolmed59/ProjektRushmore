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
    editForecast,
} from '../services/forecast.service'
import {
    newPredictionEmbedBuilder,
    allBetsEmbedBuilder,
    editForecastEmbedBuilder,
    endForecastEmbedBuilder,
    allGamblersEmbedBuilder,
    userActivePredictionsEmbedBuilder,
} from '../embeds/gamble.embed'
import {
    helperCreatePrediction,
    helperEndForecast,
} from '../services/helper.service'
import { getMoney } from '../services/money.service'
import { getActivePredictionsByUser } from '../services/prediction.service'
import { Gambler } from '../interfaces/gambler.interface'
import { GenerateId } from '../utils/id-generator'
import { guardRoleGambler } from '../utils/role-guard'

export const newInteractionHandler = async (
    interaction: Interaction
): Promise<void> => {
    //COMANDOS
    if (interaction.isChatInputCommand()) {
        // Make sure it's a guild interaction (not a DM)
        if (!interaction.inCachedGuild()) {
            interaction.reply({
                content: 'Los comandos solo funcionan en server',
            })
            return
        }
        switch (interaction.commandName) {
            case 'create-polymarket':
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
            case 'cool-club-coins-balance':
                const gamblersBalance = await getMoney()
                const leaderboardEmbed =
                    allGamblersEmbedBuilder(gamblersBalance)
                await interaction.reply({
                    embeds: [leaderboardEmbed],
                })
                break
            case 'crear-prediccion':
                const gambleIdInput =
                    interaction.options.getString('gamble-id')!
                const forecastInput = interaction.options.getString(
                    'forecast-decision'
                ) as 'yes' | 'no'
                const amountInput =
                    interaction.options.getNumber('monto-apuesta')!
                try {
                    const helperResponse = await helperCreatePrediction(
                        gambleIdInput,
                        interaction.user.id,
                        forecastInput,
                        amountInput
                    )
                    const gamblerData = helperResponse.ddbResponse?.ctx
                        .updateGamblerCommand.Attributes as Gambler
                    const forecastData = helperResponse.forecast
                    const embedForecast = newPredictionEmbedBuilder(
                        forecastData,
                        gamblerData,
                        forecastInput,
                        interaction.user.displayName,
                        helperResponse.multiplier,
                        helperResponse.amountWagered
                    )

                    await interaction.reply({
                        embeds: [embedForecast],
                    })
                } catch (e) {
                    if (e instanceof Error) {
                        const errorMessage = e.message
                        const cause = e.cause
                        await interaction.reply(
                            `Error creando prediccion. ${errorMessage}, ${(cause && JSON.stringify(cause)) || ''}`
                        )
                        return
                    }
                    await interaction.reply('Error creando prediccion')
                }
                break
            case 'editar-apuesta':
                try {
                    // Check role guard
                    guardRoleGambler(interaction.member)
                    const gambleidInput =
                        interaction.options.getString('gamble-id')!
                    const yesOddsInput =
                        interaction.options.getInteger('yes-odds')!
                    const editForecastResponse = await editForecast(
                        gambleidInput,
                        yesOddsInput
                    )
                    const editForecastEmbed =
                        editForecastEmbedBuilder(editForecastResponse)
                    await interaction.reply({
                        embeds: [editForecastEmbed],
                    })
                } catch (e) {
                    if (e instanceof Error) {
                        const errorMessage = e.message
                        const cause = e.cause
                        await interaction.reply(
                            `Error Editando Forecast. ${errorMessage}, ${(cause && JSON.stringify(cause)) || ''}`
                        )
                        return
                    }
                    await interaction.reply('Error Editando forecast')
                    return
                }
                break
            case 'finalizar-apuesta':
                try {
                    // Check role guard
                    guardRoleGambler(interaction.member)
                    const endingGambleIdInput =
                        interaction.options.getString('gamble-id')!
                    const endingOutcome = interaction.options.getString(
                        'outcome'
                    )! as 'yes' | 'no'
                    const endForecastHelperResponse = await helperEndForecast(
                        endingGambleIdInput,
                        endingOutcome
                    )
                    const endForecastEmbed = endForecastEmbedBuilder(
                        endForecastHelperResponse.forecast,
                        endForecastHelperResponse.predictions,
                        endForecastHelperResponse.arrayResults,
                        endForecastHelperResponse.results,
                        endingOutcome
                    )
                    await interaction.reply({
                        embeds: [endForecastEmbed],
                    })
                } catch (e) {
                    if (e instanceof Error) {
                        const errorMessage = e.message
                        const cause = e.cause
                        await interaction.reply(
                            `Error Finalizando Forecast. ${errorMessage}, ${(cause && JSON.stringify(cause)) || ''}`
                        )
                        return
                    }
                    await interaction.reply('Error finalizando forecast')
                    return
                }
                break
            case 'mis-predicciones':
                try {
                    const userActivePredictions = await getActivePredictionsByUser(interaction.user.id)
                    const userPredictionsEmbed = userActivePredictionsEmbedBuilder(
                        userActivePredictions,
                        interaction.user.displayName
                    )
                    await interaction.reply({
                        embeds: [userPredictionsEmbed],
                    })
                } catch (e) {
                    if (e instanceof Error) {
                        const errorMessage = e.message
                        await interaction.reply(
                            `Error obteniendo predicciones. ${errorMessage}`
                        )
                        return
                    }
                    await interaction.reply('Error obteniendo predicciones')
                    return
                }
                break
        }
    }
    // RESPUESTAS MODAL
    if (interaction.isModalSubmit()) {
        console.log(`Interaccion del comando: ${interaction.customId}`)
        if (interaction.customId === 'modalApuesta') {
            try {
                const customId = GenerateId()
                const respuesta = gamblingModalSubmission(interaction, customId)
                //create ddb record para el forecast
                await createForecast(
                    customId,
                    interaction.user.id,
                    respuesta.context.descripcion,
                    respuesta.context.yesOdds,
                    respuesta.context.amount
                )
                // Send the message with embed and buttons
                await interaction.reply({
                    embeds: respuesta.modal.embed,
                    components: respuesta.modal.component,
                })
            } catch (e) {
                if (e instanceof Error) {
                    const errorMessage = e.message
                    await interaction.reply(
                        `Error creando apuesta. ${errorMessage}`
                    )
                    return
                } else {
                    await interaction.reply('Error creando apuesta')
                }
            }
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
            const helperResponse = await helperCreatePrediction(
                gambleId,
                interaction.user.id,
                gambleDecision
            )

            const gamblerData = helperResponse.ddbResponse?.ctx
                .updateGamblerCommand.Attributes as Gambler
            const forecastData = helperResponse.forecast
            const embedRes = newPredictionEmbedBuilder(
                forecastData,
                gamblerData,
                gambleDecision,
                interaction.user.displayName,
                helperResponse.multiplier,
                helperResponse.amountWagered
            )

            await interaction.reply({
                embeds: [embedRes],
            })
        } catch (e) {
            if (e instanceof Error) {
                const errorMessage = e.message
                const cause = e.cause
                await interaction.reply(
                    `Error creando prediccion. ${errorMessage}, ${(cause && JSON.stringify(cause)) || ''}`
                )
                return
            }
            await interaction.reply('Error creando prediccion')
        }
    }
}
