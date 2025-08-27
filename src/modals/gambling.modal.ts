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
        .setCustomId('myModalId')
        .setTitle('My Awesome Modal')

    const favoriteFoodInput = new TextInputBuilder()
        .setCustomId('favoriteFoodInput')
        .setLabel('What is your favorite food?')
        .setStyle(TextInputStyle.Short)

    const ageInput = new TextInputBuilder()
        .setCustomId('ageInput')
        .setLabel('Whats your age')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)

    const firstActionRow = new ActionRowBuilder().addComponents(
        favoriteFoodInput
    )
    const secondActionRow = new ActionRowBuilder().addComponents(ageInput)
    modal.addComponents(firstActionRow as any, secondActionRow as any)
    return modal
}
