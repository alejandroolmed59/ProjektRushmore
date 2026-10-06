import { Colors, EmbedBuilder } from 'discord.js'
import {
    Forecast,
    Gambler,
    GamblerResult,
    PredictionHistory,
} from '../interfaces/gambler.interface'
import { calculateOdds } from '../utils/calculate-odds'
import { formatCcc } from '../utils/money'

export const newPredictionEmbedBuilder = (
    forecast: Forecast,
    gambler: Gambler,
    gambleDecision: 'yes' | 'no',
    discordDisplayName: string,
    multiplier: number,
    amountCents: number
): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setTitle('Nueva predicción!')
        .setDescription(
            `${discordDisplayName} acaba de apostar ${formatCcc(amountCents)} que ${gambleDecision === 'yes' ? 'SÍ ✅' : 'NO ❌'} se cumple a la apuesta de\n
             "${forecast.descripcion}"\n
            Con un multiplicador de x${multiplier}, para ganar ${formatCcc(Math.round(multiplier * amountCents))} Cool Club Coins 🤑\n
            CCC disponibles: ${formatCcc(gambler.moneyCents)}, CCC lockeadas ${formatCcc(gambler.reservedCents)} `
        )
        .setColor(gambleDecision === 'yes' ? Colors.DarkGreen : Colors.DarkRed)
    return embed
}

export const allBetsEmbedBuilder = (
    forecastArray: Forecast[]
): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setTitle('🎰Apuestas apuestas 🎰')
        .setDescription(`Total de apuestas activas: ${forecastArray.length}`)
        .setFields(
            forecastArray.map((forecast) => {
                const odds = calculateOdds(forecast.yesOdds)
                return {
                    name: forecast.descripcion,
                    value: `SI ${(odds.yesOdds * 100).toFixed(2)}%, NO ${(odds.noOdds * 100).toFixed(2)}% , Gamble ID "${forecast.gambleId}"`,
                }
            })
        )
        .setColor(Colors.DarkOrange)
    return embed
}
export const allGamblersEmbedBuilder = (gamblers: Gambler[]): EmbedBuilder => {
    const gamblersOrdered = gamblers
        .map((gambler) => ({
            ...gambler,
            totalCents: gambler.moneyCents + gambler.reservedCents,
        }))
        .sort((a, b) => b.totalCents - a.totalCents)
    const embed = new EmbedBuilder()
        .setTitle('Leaderboard 🔝')
        .setDescription(`Hall of fame de los mejores gamblers`)
        .setFields(
            gamblersOrdered.map((gambler, index) => {
                let medalla = ''
                if (index === 0) medalla = '🥇'
                if (index === 1) medalla = '🥈'
                if (index === 2) medalla = '🥉'
                return {
                    name: `${gambler.displayName}${medalla}`,
                    value: `Disponible ${formatCcc(gambler.moneyCents)}. Lockeado ${formatCcc(gambler.reservedCents)}, Total ${formatCcc(gambler.totalCents)}`,
                }
            })
        )
        .setColor(Colors.Gold)
    return embed
}
export const editForecastEmbedBuilder = (forecast: Forecast): EmbedBuilder => {
    //Calcular los porcentajes
    const odds = calculateOdds(forecast.yesOdds)

    const embed = new EmbedBuilder()
        .setTitle('Las probabilidades han cambiado! 🍀')
        .setDescription(
            `La apuesta de "${forecast.descripcion}" ha cambiado las probabilidades, ¡Hora de apostar!`
        )
        .addFields(
            {
                name: 'Probabilidad SI',
                value: `${(odds.yesOdds * 100).toFixed(2)}%`,
                inline: true,
            },
            {
                name: 'Probabilidad NO',
                value: `${(odds.noOdds * 100).toFixed(2)}%`,
                inline: true,
            },
            {
                name: 'Multiplicador SI',
                value: `x${odds.yesMultiplier}`,
                inline: true,
            },
            {
                name: 'Multiplicador NO',
                value: `x${odds.noMultiplier}`,
                inline: true,
            }
        )
        .setColor(Colors.LuminousVividPink)
    return embed
}
export const endForecastEmbedBuilder = (
    forecast: Forecast,
    predictions: PredictionHistory[],
    arrayResults: GamblerResult[],
    results: Record<string, GamblerResult>,
    endingOutcome: 'yes' | 'no'
): EmbedBuilder => {
    const predictionMessage = predictions
        .map(
            (prediction) =>
                `Gambler ${results[prediction.discordId]!.profile.displayName}, Apuesta ${formatCcc(prediction.amountCents)}, Mult x${prediction.multiplier}, Decisión ${prediction.gambleDecision === 'yes' ? '🟢' : '🔴'} ${prediction.gambleDecision}`
        )
        .join('\n')
    const embed = new EmbedBuilder()
        .setTitle('SE ACABÓ!')
        .setDescription(
            `La apuesta de "${forecast.descripcion}" ha FINALIZADO.\n
            El resultado final fue ${endingOutcome === 'yes' ? 'SÍ ✅' : 'NO ❌'}, listado de todas las apuestas: \n
            ${predictionMessage}`
        )
        .addFields(
            arrayResults.map((gamblerResult) => {
                const result =
                    gamblerResult.payoutCents - gamblerResult.wageredCents
                const displayResult =
                    result <= -30000
                        ? `${formatCcc(result)} REKT CCC 😭`
                        : `${formatCcc(result)} CCC`
                return {
                    name: gamblerResult.profile.displayName,
                    value: `Resultado ${displayResult}`,
                }
            })
        )
        .setFooter({
            text: 'Las ganancias han sido repartidas. Gracias por jugar 😎',
        })
        .setColor(endingOutcome === 'yes' ? Colors.Green : Colors.Red)
    return embed
}

export const userActivePredictionsEmbedBuilder = (
    predictions: PredictionHistory[],
    displayName: string,
    isOwnPredictions: boolean = true
): EmbedBuilder => {
    if (predictions.length === 0) {
        const title = isOwnPredictions ? '📊 Mis Predicciones Activas' : '📊 Predicciones del Usuario'
        const description = isOwnPredictions 
            ? `${displayName}, no tienes predicciones activas en este momento.`
            : `${displayName} no tiene predicciones activas en este momento.`
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(Colors.Grey)
        return embed
    }

    const title = isOwnPredictions ? '📊 Mis Predicciones Activas' : '📊 Predicciones del Usuario'
    const description = isOwnPredictions 
        ? `${displayName}, aquí están tus predicciones activas:`
        : `Aquí están las predicciones activas de ${displayName}:`

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setFields(
            predictions.map((prediction, index) => {
                const decision = prediction.gambleDecision === 'yes' ? 'SI' : 'NO'
                const potentialWin = formatCcc(
                    Math.round(prediction.multiplier * prediction.amountCents)
                )
                return {
                    name: `Predicción ${index + 1} - ${decision}`,
                    value: `**Gamble ID:** ${prediction.gambleId}\n**Apuesta:** ${formatCcc(prediction.amountCents)} CCC\n**Mult:** x${prediction.multiplier}\n**Ganancia Potencial:** ${potentialWin} CCC`,
                    inline: false,
                }
            })
        )
        .setColor(Colors.Aqua)
        .setFooter({ text: `Total de predicciones activas: ${predictions.length}` })

    return embed
}

export const gambleDetailsEmbedBuilder = (
    forecast: Forecast,
    predictions: PredictionHistory[],
    gamblers: Gambler[]
): EmbedBuilder => {
    if (predictions.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Detalles de la Apuesta')
            .setDescription(`La apuesta "${forecast.descripcion}" no tiene predicciones aún.`)
            .setColor(Colors.Grey)
        return embed
    }

    // Calculate totals
    const totalYesBets = predictions.filter(p => p.gambleDecision === 'yes')
    const totalNoBets = predictions.filter(p => p.gambleDecision === 'no')
    const totalAmountWagered = predictions.reduce((sum, p) => sum + p.amountCents, 0)
    const totalYesAmount = totalYesBets.reduce((sum, p) => sum + p.amountCents, 0)
    const totalNoAmount = totalNoBets.reduce((sum, p) => sum + p.amountCents, 0)

    const embed = new EmbedBuilder()
        .setTitle('📊 Detalles de la Apuesta')
        .setDescription(`**${forecast.descripcion}**`)
        .addFields(
            {
                name: '📈 Estadísticas',
                value: `**Total de predicciones:** ${predictions.length}\n**Total apostado:** ${formatCcc(totalAmountWagered)} CCC\n**Estado:** ${forecast.status === 'ACTIVE' ? '🟢 Activa' : '🔴 Finalizada'}`,
                inline: false,
            },
            {
                name: '✅ Apuestas por SÍ',
                value: `**Cantidad:** ${totalYesBets.length}\n**Total:** ${formatCcc(totalYesAmount)} CCC`,
                inline: true,
            },
            {
                name: '❌ Apuestas por NO',
                value: `**Cantidad:** ${totalNoBets.length}\n**Total:** ${formatCcc(totalNoAmount)} CCC`,
                inline: true,
            },
            {
                name: '🎯 Probabilidades',
                value: `**SÍ:** ${(forecast.yesOdds * 100).toFixed(2)}%\n**NO:** ${((1 - forecast.yesOdds) * 100).toFixed(2)}%`,
                inline: true,
            }
        )
        .setColor(Colors.Orange)

    // Add individual predictions if there are not too many
    if (predictions.length <= 15) {
        const discordIdToDisplayName = new Map(gamblers.map(gambler => [gambler.discordId, gambler.displayName]))
        const predictionsList = predictions.map((prediction) => {
            const displayName = discordIdToDisplayName.get(prediction.discordId) || "unknown"
            const decision = prediction.gambleDecision === 'yes' ? '✅ SÍ' : '❌ NO'
            const potentialWin = formatCcc(
                    Math.round(prediction.multiplier * prediction.amountCents)
                )
            return `${displayName} - ${decision} - ${formatCcc(prediction.amountCents)} CCC (x${prediction.multiplier}) → ${potentialWin} CCC`
        }).join('\n')

        embed.addFields({
            name: '📝 Lista de Predicciones',
            value: predictionsList,
            inline: false,
        })
    // limite execido
    } else {
        embed.addFields({
            name: '📝 Predicciones',
            value: `Hay ${predictions.length} predicciones en total`,
            inline: false,
        })
    }

    embed.setFooter({ text: `Gamble ID: ${forecast.gambleId}` })
    return embed
}
