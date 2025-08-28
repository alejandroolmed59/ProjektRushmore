import { Colors, EmbedBuilder } from 'discord.js'
import { Forecast } from '../interfaces/gambler.interface'

export const newGambleEmbedBuilder = (
    forecast: Forecast,
    gambleDecision: 'yes' | 'no',
    discordDisplayName: string,
    multiplier: number
): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setTitle('Nuevo pronostico!')
        .setDescription(
            `${discordDisplayName} acaba de apostar ${forecast.amount} que ${gambleDecision === 'yes' ? 'SI' : 'NO'} se cumple a la apuesta de "${forecast.descripcion}"\nCon un multiplicador de x${multiplier}, a ganar ${(multiplier * forecast.amount).toFixed(2)} Cool Club Coins `
        )
        .setColor(gambleDecision === 'yes' ? Colors.DarkGreen : Colors.DarkRed)
    return embed
}
