import {
    ActionRowBuilder,
    Interaction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'
import {
    gamblingModalSubmission,
    gamblingModalBuilder,
} from '../modals/gambling.modal'

export const newInteractionHandler = async (
    interaction: Interaction
): Promise<void> => {
    // RESPUESTAS
    if (interaction.isModalSubmit()) {
        console.log(`Interaccion del comando: ${interaction.customId}`)
        if (interaction.customId === 'myModalId') {
            const respuesta = gamblingModalSubmission(interaction)
            // Send the message with embed and buttons
            await interaction.reply({
                embeds: [respuesta.embed],
                components: [respuesta.component],
            })
        }
    }
    //COMANDOS
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'onooo') {
            const gamblingModal = gamblingModalBuilder()
            await interaction.showModal(gamblingModal)
        }
    }
    // button confirmado
    if (interaction.isButton()) {
        console.log(
            `Boton presionado: ${interaction.customId}, respuesta: ${interaction.customId}, interactuo con user ${interaction.user.globalName} userId ${interaction.user.id}`
        )
        const gameId = interaction.customId.split('-')[2]
        await interaction.reply({
            content: `🎮 <@${interaction.user.globalName}> joined the game! Interaction Id ${gameId}`,
        })
    }
}
