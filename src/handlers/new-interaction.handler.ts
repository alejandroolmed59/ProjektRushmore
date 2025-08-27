import {
    ActionRowBuilder,
    Interaction,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'
import {
    gamblingModalSubmission,
    gamblingModalBuilder,
    selectEndDateMenu,
} from '../modals/gambling.modal'

export const newInteractionHandler = async (
    interaction: Interaction
): Promise<void> => {
    //COMANDOS
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'polymarket') {
            // Select menu
            const endDateSelected = selectEndDateMenu()
            await interaction.reply(endDateSelected)
        }
    }
    // RESPUESTAS
    if (interaction.isModalSubmit()) {
        console.log(`Interaccion del comando: ${interaction.customId}`)
        if (interaction.customId === 'modalApuesta') {
            const respuesta = gamblingModalSubmission(interaction)
            // Send the message with embed and buttons
            await interaction.reply({
                embeds: respuesta.embed,
                components: respuesta.component,
            })
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'endDateApuesta') {
            const endDateResponse = interaction.values[0]
            if (!endDateResponse)
                throw new Error(
                    'End Date no especificada en el string select menu'
                )
            const gamblingModal = gamblingModalBuilder(endDateResponse)
            await interaction.showModal(gamblingModal)
        }
    }
    // button confirmado
    if (interaction.isButton()) {
        console.log(
            `Boton presionado: ${interaction.customId}, interactuo con user ${interaction.user.globalName} userId ${interaction.user.id}`
        )
        const gameId = interaction.customId.split('-')[2]
        await interaction.reply({
            content: `🎰 <@${interaction.user.globalName}> Acaba de apostar ${gameId}`,
        })
    }
}
