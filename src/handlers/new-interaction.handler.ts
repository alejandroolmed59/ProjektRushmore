import { Interaction } from 'discord.js'
import {
    gamblingModalSubmission,
    gamblingModalBuilder,
    customPredictionModalBuilder,
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
    gambleDetailsEmbedBuilder,
} from '../embeds/gamble.embed'
import {
    helperCreatePrediction,
    helperEndForecast,
} from '../services/helper.service'
import { getMoney } from '../services/money.service'
import {
    getActivePredictionsByUser,
    getPredictionsForForecast,
} from '../services/prediction.service'
import { parseAmountToCents } from '../utils/money'
import { GenerateId } from '../utils/id-generator'
import { guardRoleGambler } from '../utils/role-guard'
import { handleDebtsInteraction } from './debts.handler'
import { handleEmojiInteraction } from './emoji.handler'
import { handleGamesInteraction } from './games.handler'

export const newInteractionHandler = async (
    interaction: Interaction
): Promise<void> => {
    if (await handleDebtsInteraction(interaction)) return
    if (await handleEmojiInteraction(interaction)) return
    if (await handleGamesInteraction(interaction)) return
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
                const gamblingModal = gamblingModalBuilder()
                await interaction.showModal(gamblingModal)
                break
            case 'apuestas':
                const allGambles = scanForecast()
                const embedPolymarket = allBetsEmbedBuilder(allGambles)
                await interaction.reply({
                    embeds: [embedPolymarket],
                })
                break
            case 'cool-club-coins-balance':
                const gamblersBalance = getMoney()
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
                const amountCents = Math.round(
                    interaction.options.getNumber('monto-apuesta', true) * 100
                )
                if (amountCents <= 0) {
                    await interaction.reply(
                        'Error: La apuesta debe ser mayor a 0'
                    )
                    return
                }
                try {
                    const helperResponse = helperCreatePrediction(
                        gambleIdInput,
                        interaction.user.id,
                        forecastInput,
                        amountCents
                    )
                    const embedForecast = newPredictionEmbedBuilder(
                        helperResponse.forecast,
                        helperResponse.gambler,
                        forecastInput,
                        interaction.user.displayName,
                        helperResponse.multiplier,
                        helperResponse.amountCents
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
                    const editForecastResponse = editForecast(
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
                    const endForecastHelperResponse = helperEndForecast(
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
            case 'ver-predicciones':
                try {
                    const targetUser = interaction.options.getUser('usuario') || interaction.user
                    const targetUserId = targetUser.id
                    const targetDisplayName = targetUser.displayName || targetUser.username
                    const userActivePredictions = getActivePredictionsByUser(targetUserId)
                    const isOwnPredictions = targetUserId === interaction.user.id
                    const userPredictionsEmbed = userActivePredictionsEmbedBuilder(
                        userActivePredictions,
                        targetDisplayName,
                        isOwnPredictions
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
            case 'detalles-apuesta':
                try {
                    const gambleIdInput = interaction.options.getString('gamble-id')!
                    const gamblers = getMoney()
                    const forecast = getForecast(gambleIdInput)
                    const predictions = getPredictionsForForecast(gambleIdInput)
                    const detailsEmbed = gambleDetailsEmbedBuilder(forecast, predictions, gamblers)
                    await interaction.reply({
                        embeds: [detailsEmbed],
                    })
                } catch (e) {
                    if (e instanceof Error) {
                        const errorMessage = e.message
                        await interaction.reply(
                            `Error obteniendo detalles de la apuesta. ${errorMessage}`
                        )
                        return
                    }
                    await interaction.reply('Error obteniendo detalles de la apuesta')
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
                createForecast(
                    customId,
                    interaction.user.id,
                    respuesta.context.descripcion,
                    respuesta.context.yesOdds,
                    respuesta.context.amountCents
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
        } else if (interaction.customId.startsWith('custom-prediction-')) {
            // Handle custom prediction modal submission
            try {
                const gambleId = interaction.customId.replace('custom-prediction-', '')
                const forecastDecisionInput = interaction.fields.getTextInputValue('forecastDecision').toLowerCase()
                const amountCents = parseAmountToCents(
                    interaction.fields.getTextInputValue('amountWagered')
                )
                // Validate forecast decision
                if (forecastDecisionInput !== 'sí' && forecastDecisionInput !== 'si' && forecastDecisionInput !== 'no') {
                    await interaction.reply('Error: La predicción debe ser "SI" o "NO" 0t')
                    return
                }
                
                const forecastDecision = (forecastDecisionInput === 'sí' || forecastDecisionInput === 'si') ? 'yes' : 'no'
                
                // Validate amount
                if (amountCents === null) {
                    await interaction.reply('Error: La apuesta debe ser mayor a 0')
                    return
                }
                
                const helperResponse = helperCreatePrediction(
                    gambleId,
                    interaction.user.id,
                    forecastDecision,
                    amountCents
                )
                const embedForecast = newPredictionEmbedBuilder(
                    helperResponse.forecast,
                    helperResponse.gambler,
                    forecastDecision,
                    interaction.user.displayName,
                    helperResponse.multiplier,
                    helperResponse.amountCents
                )

                await interaction.reply({
                    embeds: [embedForecast],
                })
            } catch (e) {
                if (e instanceof Error) {
                    const errorMessage = e.message
                    const cause = e.cause
                    await interaction.reply(
                        `Error creando predicción personalizada. ${errorMessage}, ${(cause && JSON.stringify(cause)) || ''}`
                    )
                    return
                }
                await interaction.reply('Error creando predicción personalizada')
            }
        }
    }
    // DESPUES DEL SLASH COMMAND
    /* DEPRECADO: MENU SELECT FECHA LIMITE 
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
    }*/
    // BUTTON PRESSED
    if (interaction.isButton()) {
        const interactionContext = interaction.customId.split('-')
        const action = interactionContext[0]
        const gambleId = interactionContext[2]
        
        // Handle custom prediction button
        if (action === 'custom') {
            if (!gambleId) {
                await interaction.reply('Error: No se pudo obtener el ID de la apuesta')
                return
            }
            try {
                const customModal = customPredictionModalBuilder(gambleId)
                await interaction.showModal(customModal)
            } catch (e) {
                if (e instanceof Error) {
                    await interaction.reply(`Error mostrando modal: ${e.message}`)
                    return
                }
                await interaction.reply('Error mostrando modal')
            }
            return
        }
        // Handle yes or no button
        const gambleDecision = action as 'yes' | 'no'
        if (!gambleDecision || !gambleId)
            throw new Error(
                `Error when creating users bet, gambleId ${gambleId}, decision ${gambleDecision} `
            )
        try {
            const helperResponse = helperCreatePrediction(
                gambleId,
                interaction.user.id,
                gambleDecision
            )
            const embedRes = newPredictionEmbedBuilder(
                helperResponse.forecast,
                helperResponse.gambler,
                gambleDecision,
                interaction.user.displayName,
                helperResponse.multiplier,
                helperResponse.amountCents
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
