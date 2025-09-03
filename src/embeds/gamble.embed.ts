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
        .setTitle('Nueva prediccion!')
        .setDescription(
            `${discordDisplayName} acaba de apostar ${amountWagered} que ${gambleDecision === 'yes' ? 'SI' : 'NO'} se cumple a la apuesta de "${forecast.descripcion}"\n
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
        .setDescription(`Total de apuestas activas ${forecastArray.length}`)
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
            totalMoney: gambler.money + gambler.moneyReserved,
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
        .setTitle('Las probabilidades cambiaron!! 🍀')
        .setDescription(
            `La apuesta de "${forecast.descripcion}" cambiaron las probabilidades, Hora de APOSTAR!`
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
                `Gambler ${results[prediction.discordId]!.profile.displayName}, Apuesta ${prediction.amountWagered}, Mult x${prediction.multiplier}, Decision ${prediction.gambleDecision}`
        )
        .join('\n')
    const embed = new EmbedBuilder()
        .setTitle('SE ACABÓ!')
        .setDescription(
            `La apuesta de "${forecast.descripcion}" acabó.\n
            El resultado final fue ${endingOutcome === 'yes' ? 'SI' : 'NO'}, listado de todas las apuestas: \n
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
