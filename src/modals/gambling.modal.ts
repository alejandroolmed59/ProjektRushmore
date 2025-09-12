import {
    ActionRowBuilder,
    ActionRowData,
    AnyComponentBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    InteractionReplyOptions,
    ModalBuilder,
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'
import { calculateOdds } from '../utils/calculate-odds'
interface ModalSubmissionReturn {
    modal: {
        embed: EmbedBuilder[]
        component: ActionRowData<AnyComponentBuilder>[]
    }
    context: {
        descripcion: string
        yesOdds: number
        amount: number
    }
}
export const gamblingModalSubmission = (
    interaction: ModalSubmitInteraction,
    customId: string
): ModalSubmissionReturn => {
    const descripcionApuesta =
        interaction.fields.getTextInputValue('descripcionApuesta')
    const montoApuesta = Number(
        interaction.fields.getTextInputValue('montoApuesta')
    )
    if (!montoApuesta || isNaN(montoApuesta) || montoApuesta < 0)
        throw new Error(`Monto de apuesta ${montoApuesta} invalido`)
    const probabilidadApuestaInput =
        Number(interaction.fields.getTextInputValue('probabilidadApuesta')) /
        100
    if (
        !probabilidadApuestaInput ||
        isNaN(probabilidadApuestaInput) ||
        probabilidadApuestaInput < 0.01 ||
        probabilidadApuestaInput > 0.99
    )
        throw new Error(
            `Numero no valido ${probabilidadApuestaInput} en probabilidad de apuesta`
        )
    //Calcular los porcentajes
    const odds = calculateOdds(probabilidadApuestaInput)
    // Create the embed
    const gameMatchEmbed = new EmbedBuilder()
        .setColor(Colors.Purple)
        .setTitle(`@${interaction.user.username} creó una nueva apuesta 🟢💲`)
        .setDescription(descripcionApuesta)
        .addFields(
            {
                name: 'Probabilidad SI ✅',
                value: `${(odds.yesOdds * 100).toFixed(2)}%`,
                inline: true,
            },
            {
                name: 'Probabilidad NO ❌',
                value: `${(odds.noOdds * 100).toFixed(2)}%`,
                inline: true,
            },
            {
                name: 'Apuesta inicial 💷',
                value: `${montoApuesta} CCC`,
                inline: true,
            }
        )
        .setTimestamp()
        .setFooter({ text: `Gamble ID: ${customId}` })
    // Create the buttons
    const siButton = new ButtonBuilder()
        .setCustomId(`yes-gamble-${customId}`)
        .setLabel(`SI x${odds.yesMultiplier} ✅`)
        .setStyle(ButtonStyle.Success)

    const noButton = new ButtonBuilder()
        .setCustomId(`no-gamble-${customId}`)
        .setLabel(`NO x${odds.noMultiplier} 🥀`)
        .setStyle(ButtonStyle.Danger)
    const customPredictionButton = new ButtonBuilder()
        .setCustomId(`custom-gamble-${customId}`)
        .setLabel('Feeling lucky 🍀')
        .setStyle(ButtonStyle.Primary)

    // Create action row with buttons
    const buttonRow = new ActionRowBuilder().addComponents(siButton, noButton)
    const buttonRow2 = new ActionRowBuilder().addComponents(customPredictionButton)
    return {
        modal: {
            embed: [gameMatchEmbed],
            component: [buttonRow, buttonRow2] as any,
        },
        context: {
            descripcion: descripcionApuesta,
            yesOdds: odds.yesOdds,
            amount: montoApuesta,
        },
    }
}

export const gamblingModalBuilder = (): ModalBuilder => {
    const modal = new ModalBuilder()
        .setCustomId('modalApuesta')
        .setTitle('❤️♠️♦️♣️ Hora de apostar ')

    const descripcionApuesta = new TextInputBuilder()
        .setCustomId('descripcionApuesta')
        .setLabel('A que le vamos a apostar hoy?')
        .setPlaceholder(
            'El zork se termina silksong antes de que termine septiembre?'
        )
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)

    const probabilidadApuesta = new TextInputBuilder()
        .setCustomId('probabilidadApuesta')
        .setLabel('Cual es la probabilidad de que se gane?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('60')
        .setRequired(true)

    const montoApuesta = new TextInputBuilder()
        .setCustomId('montoApuesta')
        .setLabel('Cuantas CCC van a apostar los participantes?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('200')
        .setRequired(true)


    const firstActionRow = new ActionRowBuilder().addComponents(
        descripcionApuesta
    )
    const secondActionRow = new ActionRowBuilder().addComponents(
        probabilidadApuesta
    )
    const thirdActionRow = new ActionRowBuilder().addComponents(montoApuesta)
    modal.addComponents(
        firstActionRow as any,
        secondActionRow as any,
        thirdActionRow as any,
    )
    return modal
}

export const customPredictionModalBuilder = (gambleId: string): ModalBuilder => {
    const modal = new ModalBuilder()
        .setCustomId(`custom-prediction-${gambleId}`)
        .setTitle('🍀 Feeling Lucky')

    const forecastDecision = new TextInputBuilder()
        .setCustomId('forecastDecision')
        .setLabel('¿Cuál es tu predicción?')
        .setPlaceholder('SI o NO')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(3)

    const amountWagered = new TextInputBuilder()
        .setCustomId('amountWagered')
        .setLabel('¿Cuántas CCC quieres apostar?')
        .setPlaceholder('100')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)

    const firstActionRow = new ActionRowBuilder().addComponents(forecastDecision)
    const secondActionRow = new ActionRowBuilder().addComponents(amountWagered)
    
    modal.addComponents(
        firstActionRow as any,
        secondActionRow as any,
    )
    return modal
}

/* DEPRECADO: MENU SELECT FECHA LIMITE
export const selectEndDateMenu = (): InteractionReplyOptions => {
    const endDateMenu = new StringSelectMenuBuilder()
        .setCustomId('endDateApuesta')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Horas')
                .setDescription('La apuesta se cierra en 2 horas')
                .setValue('2Hours')
                .setEmoji('🕑'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Final del dia')
                .setDescription('La apuesta se cierra al final del dia')
                .setValue('endDay')
                .setEmoji('🌙'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Semana')
                .setDescription('La apuesta se cierra en una semana')
                .setValue('1Week')
                .setEmoji('🌄'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Mes')
                .setDescription('La apuesta se cierra en un mes')
                .setValue('1Month')
                .setEmoji('📅')
        )
    const row = new ActionRowBuilder().addComponents(endDateMenu)
    return {
        content: 'Cuando es la fecha limite de la apuesta?',
        components: [row as any],
        flags: 'Ephemeral',
    }
}*/
