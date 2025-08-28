import { Colors, EmbedBuilder } from 'discord.js'
import { Forecast, Gambler } from '../interfaces/gambler.interface'

export const newGambleEmbedBuilder = (
    forecast: Forecast,
    gambler: Gambler,
    gambleDecision: 'yes' | 'no',
    discordDisplayName: string,
    multiplier: number
): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setTitle('Nuevo pronostico!')
        .setDescription(
            `${discordDisplayName} acaba de apostar ${forecast.amount} que ${gambleDecision === 'yes' ? 'SI' : 'NO'} se cumple a la apuesta de "${forecast.descripcion}"\n
            Con un multiplicador de x${multiplier}, para ganar ${(multiplier * forecast.amount).toFixed(2)} Cool Club Coins 🤑\n
            CCC dispomibles: ${gambler.money}, CCC lockeadas ${gambler.moneyReserved} `
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
                return {
                    name: forecast.descripcion,
                    value: `SI ${forecast.yesOdds * 100}%, NO ${(1 - forecast.yesOdds) * 100}% , id ${forecast.gambleId}`,
                }
            })
        )
        .setColor(Colors.Purple)
    return embed
}
