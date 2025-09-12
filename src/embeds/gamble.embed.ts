import { Colors, EmbedBuilder } from 'discord.js'
import {
    Forecast,
    Gambler,
    GamblerResult,
    PredictionHistory,
} from '../interfaces/gambler.interface'
import { calculateOdds } from '../utils/calculate-odds'

export const newPredictionEmbedBuilder = (
    forecast: Forecast,
    gambler: Gambler,
    gambleDecision: 'yes' | 'no',
    discordDisplayName: string,
    multiplier: number,
    amountWagered: number
): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setTitle('Nueva predicción!')
        .setDescription(
            `${discordDisplayName} acaba de apostar ${amountWagered} que ${gambleDecision === 'yes' ? 'SÍ' : 'NO'} se cumple a la apuesta de "${forecast.descripcion}"\n
            Con un multiplicador de x${multiplier}, para ganar ${(multiplier * amountWagered).toFixed(2)} Cool Club Coins 🤑\n
            CCC disponibles: ${gambler.money}, CCC lockeadas ${gambler.moneyReserved} `
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
            totalMoney: parseFloat((gambler.money + gambler.moneyReserved).toFixed(2)),
        }))
        .sort((a, b) => b.totalMoney - a.totalMoney)
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
                    value: `Disponible ${gambler.money}. Lockeado ${gambler.moneyReserved}, Total ${gambler.totalMoney}`,
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
                `Gambler ${results[prediction.discordId]!.profile.displayName}, Apuesta ${prediction.amountWagered}, Mult x${prediction.multiplier}, Decisión ${prediction.gambleDecision}`
        )
        .join('\n')
    const embed = new EmbedBuilder()
        .setTitle('SE ACABÓ!')
        .setDescription(
            `La apuesta de "${forecast.descripcion}" ha terminado.\n
            El resultado final fue ${endingOutcome === 'yes' ? 'SÍ' : 'NO'}, listado de todas las apuestas: \n
            ${predictionMessage}`
        )
        .addFields(
            arrayResults.map((gamblerResult) => {
                return {
                    name: gamblerResult.profile.displayName,
                    value: `Resultado ${gamblerResult.totalWon - gamblerResult.totalLost} CCC`,
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
                const potentialWin = (prediction.multiplier * prediction.amountWagered).toFixed(2)
                return {
                    name: `Predicción ${index + 1} - ${decision}`,
                    value: `**Gamble ID:** ${prediction.gambleId}\n**Apuesta:** ${prediction.amountWagered} CCC\n**Mult:** x${prediction.multiplier}\n**Ganancia Potencial:** ${potentialWin} CCC`,
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
    const totalAmountWagered = predictions.reduce((sum, p) => sum + p.amountWagered, 0)
    const totalYesAmount = totalYesBets.reduce((sum, p) => sum + p.amountWagered, 0)
    const totalNoAmount = totalNoBets.reduce((sum, p) => sum + p.amountWagered, 0)

    const embed = new EmbedBuilder()
        .setTitle('📊 Detalles de la Apuesta')
        .setDescription(`**${forecast.descripcion}**`)
        .addFields(
            {
                name: '📈 Estadísticas',
                value: `**Total de predicciones:** ${predictions.length}\n**Total apostado:** ${totalAmountWagered} CCC\n**Estado:** ${forecast.status === 'ACTIVE' ? '🟢 Activa' : '🔴 Finalizada'}`,
                inline: false,
            },
            {
                name: '✅ Apuestas por SÍ',
                value: `**Cantidad:** ${totalYesBets.length}\n**Total:** ${totalYesAmount} CCC`,
                inline: true,
            },
            {
                name: '❌ Apuestas por NO',
                value: `**Cantidad:** ${totalNoBets.length}\n**Total:** ${totalNoAmount} CCC`,
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
            const potentialWin = (prediction.multiplier * prediction.amountWagered).toFixed(2)
            return `${displayName} - ${decision} - ${prediction.amountWagered} CCC (x${prediction.multiplier}) → ${potentialWin} CCC`
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

export const predictionMarketEmbedBuilder = (
    forecasts: Forecast[],
    currentPage: number = 1,
    totalPages: number = 1,
    filter: 'all' | 'active' | 'finished' = 'all'
): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setTitle('🎰 Mercado de Predicciones')
        .setDescription(`[Cómo apostar parcialmente ↗](https://example.com)`)
        .setColor(Colors.DarkBlue)

    // Add market orders (forecasts)
    if (forecasts.length === 0) {
        embed.addFields({
            name: '📊 Sin Apuestas Disponibles',
            value: 'No hay apuestas activas en este momento.',
            inline: false,
        })
    } else {
        forecasts.forEach((forecast, index) => {
            const odds = calculateOdds(forecast.yesOdds)
            const statusEmoji = forecast.status === 'ACTIVE' ? '🟢' : '🔴'
            const statusText = forecast.status === 'ACTIVE' ? 'Activa' : 'Finalizada'
            
            embed.addFields({
                name: `${statusEmoji} ${forecast.descripcion}`,
                value: `**Probabilidades:** SÍ ${(odds.yesOdds * 100).toFixed(2)}% | NO ${(odds.noOdds * 100).toFixed(2)}%\n**Multiplicadores:** SÍ x${odds.yesMultiplier} | NO x${odds.noMultiplier}\n**Estado:** ${statusText}\n**ID:** ${forecast.gambleId}`,
                inline: false,
            })
        })
    }

    // Add pagination info
    embed.setFooter({ 
        text: `Página ${currentPage} de ${totalPages} • Filtro: ${filter === 'all' ? 'Todas' : filter === 'active' ? 'Activas' : 'Finalizadas'}`
    })

    return embed
}
