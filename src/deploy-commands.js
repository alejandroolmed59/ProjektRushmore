const { REST, Routes, SlashCommandBuilder } = require('discord.js')
require('dotenv').config()

const clientId = process.env.CLIENT_ID // Your bot's application ID
const guildId = process.env.GUILD_ID // Optional: for guild-specific commands
const token = process.env.TOKEN

// Initialize REST client
const rest = new REST().setToken(token)

// Function to manually define commands (alternative to files)
function defineCommands() {
    return [
        new SlashCommandBuilder()
            .setName('polymarket')
            .setDescription('❤️♠️♦️♣️ Hora de apostar ❤️♠️♦️♣️')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('apuestas')
            .setDescription('Lista de apuestas activas')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('prediccion')
            .setDescription('Apuesta un monto a una apuesta activa')
            .addStringOption((option) =>
                option
                    .setName('gamble-id')
                    .setDescription(
                        'Id de la apuesta, usa /apuestas para ver todas'
                    )
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName('forecast-decision')
                    .setDescription('Predecir a SI o NO')
                    .addChoices([
                        { name: 'SI', value: 'yes' },
                        { name: 'NO', value: 'no' },
                    ])
                    .setRequired(true)
            )
            .addNumberOption((option) =>
                option
                    .setName('monto-apuesta')
                    .setDescription('Cuanto quieres apostar?')
                    .setRequired(true)
            )
            .toJSON(),
        new SlashCommandBuilder()
            .setName('editarapuesta')
            .setDescription('Edita una apuesta existente por su ID')
            .addStringOption((option) =>
                option
                    .setName('gamble-id')
                    .setDescription(
                        'Id de la apuesta, usa /apuestas para ver todas'
                    )
                    .setRequired(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName('yes-odds')
                    .setDescription('A cuanto cambio la probabilidad de SI?? Ejemplo 33')
                    .setRequired(true)
            ),
    ]
}

// DEPLOY COMMANDS
async function deployCommands() {
    try {
        const commands = defineCommands()

        console.log(
            `🚀 Started refreshing ${commands.length} application (/) commands.`
        )

        // Deploy to specific guild (faster, for development)
        if (guildId) {
            const data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            )
            console.log(
                `✅ Successfully reloaded ${data.length} guild application (/) commands.`
            )
        }
        // Deploy globally (takes up to 1 hour to propagate)
        else {
            const data = await rest.put(Routes.applicationCommands(clientId), {
                body: commands,
            })
            console.log(
                `✅ Successfully reloaded ${data.length} global application (/) commands.`
            )
        }
    } catch (error) {
        console.error('❌ Error deploying commands:', error)
    }
}

// DELETE ALL COMMANDS
async function deleteAllCommands() {
    try {
        console.log('🗑️  Started deleting all application (/) commands.')

        // Delete guild commands
        if (guildId) {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
                body: [],
            })
            console.log(
                '✅ Successfully deleted all guild application (/) commands.'
            )
        }
        // Delete global commands
        else {
            await rest.put(Routes.applicationCommands(clientId), { body: [] })
            console.log(
                '✅ Successfully deleted all global application (/) commands.'
            )
        }
    } catch (error) {
        console.error('❌ Error deleting commands:', error)
    }
}

// DELETE SPECIFIC COMMAND
async function deleteSpecificCommand(commandName) {
    try {
        // Get all commands first
        const commands = guildId
            ? await rest.get(Routes.applicationGuildCommands(clientId, guildId))
            : await rest.get(Routes.applicationCommands(clientId))

        // Find the command to delete
        const commandToDelete = commands.find((cmd) => cmd.name === commandName)

        if (!commandToDelete) {
            console.log(`❌ Command "${commandName}" not found.`)
            return
        }

        // Delete the specific command
        if (guildId) {
            await rest.delete(
                Routes.applicationGuildCommand(
                    clientId,
                    guildId,
                    commandToDelete.id
                )
            )
        } else {
            await rest.delete(
                Routes.applicationCommand(clientId, commandToDelete.id)
            )
        }

        console.log(`✅ Successfully deleted command "${commandName}".`)
    } catch (error) {
        console.error(`❌ Error deleting command "${commandName}":`, error)
    }
}

// LIST ALL COMMANDS
async function listCommands() {
    try {
        const commands = guildId
            ? await rest.get(Routes.applicationGuildCommands(clientId, guildId))
            : await rest.get(Routes.applicationCommands(clientId))

        console.log(`📋 Found ${commands.length} commands:`)
        commands.forEach((cmd, index) => {
            console.log(`  ${index + 1}. /${cmd.name} - ${cmd.description}`)
        })
    } catch (error) {
        console.error('❌ Error listing commands:', error)
    }
}

// UPDATE SPECIFIC COMMAND
async function updateCommand(commandName, newCommandData) {
    try {
        // Get all commands
        const commands = guildId
            ? await rest.get(Routes.applicationGuildCommands(clientId, guildId))
            : await rest.get(Routes.applicationCommands(clientId))

        // Find the command to update
        const commandToUpdate = commands.find((cmd) => cmd.name === commandName)

        if (!commandToUpdate) {
            console.log(`❌ Command "${commandName}" not found.`)
            return
        }

        // Update the specific command
        if (guildId) {
            await rest.patch(
                Routes.applicationGuildCommand(
                    clientId,
                    guildId,
                    commandToUpdate.id
                ),
                { body: newCommandData }
            )
        } else {
            await rest.patch(
                Routes.applicationCommand(clientId, commandToUpdate.id),
                { body: newCommandData }
            )
        }

        console.log(`✅ Successfully updated command "${commandName}".`)
    } catch (error) {
        console.error(`❌ Error updating command "${commandName}":`, error)
    }
}

// COMMAND LINE INTERFACE
const args = process.argv.slice(2)
const action = args[0]

switch (action) {
    case 'deploy':
        deployCommands()
        break

    case 'delete-all':
        deleteAllCommands()
        break

    case 'delete':
        const commandToDelete = args[1]
        if (commandToDelete) {
            deleteSpecificCommand(commandToDelete)
        } else {
            console.log('❌ Please specify a command name to delete.')
            console.log('Usage: node deploy-commands.js delete <command-name>')
        }
        break

    case 'list':
        listCommands()
        break

    case 'update':
        const commandToUpdate = args[1]
        if (commandToUpdate) {
            // Example: update ping command description
            const newData = new SlashCommandBuilder()
                .setName('ping')
                .setDescription('Updated description: Replies with Pong!')
                .toJSON()
            updateCommand(commandToUpdate, newData)
        } else {
            console.log('❌ Please specify a command name to update.')
        }
        break

    default:
        console.log('Available actions:')
        console.log('  deploy       - Deploy all commands')
        console.log('  delete-all   - Delete all commands')
        console.log('  delete <name> - Delete specific command')
        console.log('  list         - List all commands')
        console.log('  update <name> - Update specific command')
        console.log('')
        console.log('Examples:')
        console.log('  node deploy-commands.js deploy')
        console.log('  node deploy-commands.js delete ping')
        console.log('  node deploy-commands.js list')
}

module.exports = {
    deployCommands,
    deleteAllCommands,
    deleteSpecificCommand,
    listCommands,
    updateCommand,
}
