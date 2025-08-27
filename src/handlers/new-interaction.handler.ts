import {
    ActionRowBuilder,
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
        const foodResponse =
            interaction.fields.getTextInputValue('favoriteFoodInput')
        const ageResponse = interaction.fields.getTextInputValue('ageInput')

        await interaction.reply({
            content: `Profile updated!\n**Food:** ${foodResponse}\n**Age:** ${ageResponse}`,
            ephemeral: true,
        })
    }
    if (!interaction.isChatInputCommand()) return
    //COMANDOS
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
        const secondActionRow = new ActionRowBuilder().addComponents(ageInput)

        modal.addComponents(firstActionRow as any, secondActionRow as any)

        await interaction.showModal(modal)
    }
}
