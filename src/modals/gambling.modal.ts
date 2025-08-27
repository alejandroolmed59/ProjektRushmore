import {
    ActionRowBuilder,
    ActionRowData,
    AnyComponentBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'

export const gamblingModalSubmission = (
    interaction: ModalSubmitInteraction
): {
    embed: EmbedBuilder[]
    component: ActionRowData<AnyComponentBuilder>[]
} => {
    const descripcionApuesta =
        interaction.fields.getTextInputValue('descripcionApuesta')
    const probabilidadApuestaInput =
        Number(interaction.fields.getTextInputValue('probabilidadApuesta')) /
        100
    if (!probabilidadApuestaInput)
        throw new Error(
            'Formato de numero no valido en probabilidad de apuesta input'
        )
    const endDate = interaction.fields.getTextInputValue('endDateApuesta')
    //Calcular los porcentajes
    const probabilidadSi = probabilidadApuestaInput
    const probabilidadNo = 1 - probabilidadSi
    const multiplicadorSi = (1 / probabilidadSi).toFixed(2)
    const multiplicadorNo = (1 / probabilidadNo).toFixed(2)
    // Create the embed
    const gameMatchEmbed = new EmbedBuilder()
        .setColor(Colors.DarkOrange) // Discord blurple color
        .setTitle(`@${interaction.user.username} creó una nueva apuesta 🤑`)
        .setDescription(descripcionApuesta)
        .addFields(
            {
                name: 'Probabilidad SI',
                value: `${probabilidadSi}%`,
                inline: true,
            },
            {
                name: 'Probabilidad NO',
                value: `${probabilidadNo}%`,
                inline: true,
            }
        )
        .setTimestamp()
    // Create the buttons
    const siButton = new ButtonBuilder()
        .setCustomId(`si-apuesta-${interaction.id}`)
        .setLabel(`SI x${multiplicadorSi} 🍀`)
        .setStyle(ButtonStyle.Primary)

    const noButton = new ButtonBuilder()
        .setCustomId(`no-apuesta-${interaction.id}`)
        .setLabel(`NO x${multiplicadorNo} 🥀`)
        .setStyle(ButtonStyle.Danger)

    // Create action row with buttons
    const buttonRow = new ActionRowBuilder().addComponents(siButton, noButton)
    return {
        embed: [gameMatchEmbed],
        component: [buttonRow] as any,
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

    const endDate = new TextInputBuilder()
        .setCustomId('endDateApuesta')
        .setLabel('Cuando es la fecha limite de la apuesta')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1756389600')
        .setRequired(false)
    const firstActionRow = new ActionRowBuilder().addComponents(
        descripcionApuesta
    )
    const secondActionRow = new ActionRowBuilder().addComponents(
        probabilidadApuesta
    )
    const thirdActionRow = new ActionRowBuilder().addComponents(endDate)
    modal.addComponents(
        firstActionRow as any,
        secondActionRow as any,
        thirdActionRow as any
    )
    return modal
}
