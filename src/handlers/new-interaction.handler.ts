import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    Interaction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'

export const newInteractionHandler = async (
    interaction: Interaction
): Promise<void> => {
    // RESPUESTAS
    if (interaction.isModalSubmit()) {
        console.log(`Respuesta del comando: ${interaction.customId}`)
        //TODO: Hacer un if por cada interaction.customId
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

        // Send the message with embed and buttons
        await interaction.reply({
            embeds: [gameMatchEmbed],
            components: [buttonRow as any],
        })
    }
    //COMANDOS
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'onooo') {
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
            const secondActionRow = new ActionRowBuilder().addComponents(
                ageInput
            )
            modal.addComponents(firstActionRow as any, secondActionRow as any)
            await interaction.showModal(modal)
        }
    }
    // button confirmado
    if (interaction.isButton()) {
        console.log(
            `Boton presionado: ${interaction.customId}, respuesta: ${interaction.customId}, interactuo con ${interaction.user.globalName} ${interaction.user.id}`
        )
        const gameId = interaction.customId.split('-')[2]
        console.log(gameId)
        await interaction.reply({
            content: `🎮 <@${interaction.user.globalName}> joined the game! Interaction Id ${gameId}`,
            ephemeral: false,
        })
    }
}
