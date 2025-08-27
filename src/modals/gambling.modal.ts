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
): { embed: EmbedBuilder; component: ActionRowData<AnyComponentBuilder> } => {
    const foodResponse =
        interaction.fields.getTextInputValue('favoriteFoodInput')
    const ageResponse = interaction.fields.getTextInputValue('ageInput')
    // Create the embed
    const gameMatchEmbed = new EmbedBuilder()
        .setColor(Colors.DarkOrange) // Discord blurple color
        .setTitle('Game match request')
        .setDescription(
            `@${interaction.user.username} created a new game with id ${interaction.id} match request`
        )
        .addFields(
            {
                name: 'Comida fav',
                value: foodResponse,
                inline: true,
            },
            {
                name: 'Edad',
                value: ageResponse,
                inline: true,
            }
        )
        .setTimestamp()

    // Create the buttons
    const joinButton = new ButtonBuilder()
        .setCustomId(`join-game-${interaction.id}`)
        .setLabel('Join')
        .setStyle(ButtonStyle.Primary)

    const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel-game-${interaction.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)

    // Create action row with buttons
    const buttonRow = new ActionRowBuilder().addComponents(
        joinButton,
        cancelButton
    )
    return {
        embed: gameMatchEmbed,
        component: buttonRow as any,
    }
}

export const gamblingModalBuilder = (): ModalBuilder => {
    const modal = new ModalBuilder()
        .setCustomId('modalApuesta')
        .setTitle('❤️♠️♦️♣️ Hora de apostar ❤️♠️♦️♣️')

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
        .setLabel('Cual es el % de probabilidad inicial de que se gane?')
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
