import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Interaction,
    MessageFlags,
} from 'discord.js'
import {
    addGame,
    Game,
    GameFormat,
    listCatalog,
    listCopies,
    matchTitle,
    removeGame,
    searchTitles,
    TitleEntry,
} from '../services/games.service'

export const GAME_COMMANDS = ['juegos', 'quien-tiene']
const MAX_MESSAGE_LENGTH = 1900
const MAX_CHOICE_LENGTH = 100

/** Handles game library commands and their autocomplete. Returns true when it took the interaction. */
export const handleGamesInteraction = async (
    interaction: Interaction
): Promise<boolean> => {
    if (
        interaction.isAutocomplete() &&
        GAME_COMMANDS.includes(interaction.commandName)
    ) {
        await autocompleteTitle(interaction)
        return true
    }
    if (
        !interaction.isChatInputCommand() ||
        !GAME_COMMANDS.includes(interaction.commandName)
    )
        return false

    // Same rule as the other commands: server only, never DMs.
    if (!interaction.inCachedGuild()) {
        await interaction.reply({
            content: 'Los comandos solo funcionan en server',
            flags: MessageFlags.Ephemeral,
        })
        return true
    }
    try {
        await handleCommand(interaction)
    } catch (e) {
        console.log('[games] interaction failed:', e)
        await send(
            interaction,
            `Error: ${e instanceof Error ? e.message : String(e)}`,
            true
        )
    }
    return true
}

const autocompleteTitle = async (
    interaction: AutocompleteInteraction
): Promise<void> => {
    try {
        const titles = searchTitles(interaction.options.getFocused())
        await interaction.respond(
            titles.map((t) => {
                const name = t.title.slice(0, MAX_CHOICE_LENGTH)
                return { name, value: name }
            })
        )
    } catch (e) {
        console.log('[games] autocomplete failed:', e)
    }
}

// ---------- replies ----------

/** Reply, or edit the deferred reply. Never pings: mentions are only labels here. */
const send = async (
    interaction: ChatInputCommandInteraction,
    content: string,
    ephemeral = false
): Promise<void> => {
    const text =
        content.length > MAX_MESSAGE_LENGTH
            ? `${content.slice(0, MAX_MESSAGE_LENGTH)}\n…`
            : content
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
            content: text,
            allowedMentions: { parse: [] },
        })
        return
    }
    await interaction.reply({
        content: text,
        allowedMentions: { parse: [] },
        ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
    })
}

const mention = (userId: string): string => `<@${userId}>`
const formatLabel = (format: GameFormat): string =>
    format === 'fisico' ? 'físico' : 'digital'

/**
 * Turn what the user typed into a library title. Replies and returns null
 * when it's unknown or ambiguous.
 */
const resolveTitle = async (
    interaction: ChatInputCommandInteraction,
    query: string
): Promise<TitleEntry | null> => {
    const match = matchTitle(query)
    if (match.kind === 'match') return match.entry
    if (match.kind === 'ambiguous') {
        const options = match.candidates.map((c) => `• ${c.title}`).join('\n')
        await send(interaction, `¿Cuál de estos?\n${options}`, true)
        return null
    }
    await send(interaction, `No encontré "${query}" en la biblioteca`, true)
    return null
}

// ---------- commands ----------

const handleCommand = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    if (interaction.commandName === 'quien-tiene')
        return whoHas(interaction, interaction.options.getString('juego', true))

    switch (interaction.options.getSubcommand()) {
        case 'quien-tiene':
            return whoHas(
                interaction,
                interaction.options.getString('titulo', true)
            )
        case 'catalogo':
            return showCatalog(interaction)
        case 'agregar':
            return add(interaction)
        case 'quitar':
            return remove(interaction)
    }
}

const copyLine = (game: Game): string =>
    `• ${formatLabel(game.format)} de ${mention(game.owner_id)}`

const whoHas = async (
    interaction: ChatInputCommandInteraction,
    query: string
): Promise<void> => {
    const entry = await resolveTitle(interaction, query)
    if (!entry) return
    const copies = listCopies(entry.titleKey)
    await send(
        interaction,
        `🎮 **${entry.title}**\n${copies.map(copyLine).join('\n')}`
    )
}

const showCatalog = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const owner = interaction.options.getUser('usuario')
    const games = listCatalog(owner?.id)
    if (games.length === 0)
        return send(
            interaction,
            owner
                ? `${mention(owner.id)} no tiene juegos registrados`
                : 'La biblioteca está vacía, usa `/juegos agregar`',
            true
        )

    const byOwner = new Map<string, Game[]>()
    games.forEach((g) =>
        byOwner.set(g.owner_id, [...(byOwner.get(g.owner_id) ?? []), g])
    )
    const sections = [...byOwner].map(([ownerId, owned]) => {
        const list = (format: GameFormat): string =>
            owned
                .filter((g) => g.format === format)
                .map((g) => g.title)
                .join(', ')
        const physical = list('fisico')
        const digital = list('digital')
        return [
            mention(ownerId),
            ...(physical ? [`  💿 ${physical}`] : []),
            ...(digital ? [`  ☁️ ${digital}`] : []),
        ].join('\n')
    })
    await send(interaction, `📚 **Catálogo**\n${sections.join('\n')}`)
}

const add = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const owner = interaction.options.getUser('dueno') ?? interaction.user
    if (owner.bot)
        return send(interaction, 'Los bots no juegan Switch 🤖', true)
    const title = interaction.options.getString('titulo', true).trim()
    if (!title) return send(interaction, 'Pon un título', true)
    const format = interaction.options.getString('formato', true) as GameFormat
    const aliases = (interaction.options.getString('alias') ?? '')
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)

    const { status, game } = addGame({
        title,
        ownerId: owner.id,
        format,
        aliases,
    })
    const label = `**${game.title}** (${formatLabel(format)}) de ${mention(owner.id)}`
    await send(
        interaction,
        status === 'exists' ? `${label} ya estaba registrado` : `✅ ${label}`,
        status === 'exists'
    )
}

const remove = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const entry = await resolveTitle(
        interaction,
        interaction.options.getString('titulo', true)
    )
    if (!entry) return
    const format = interaction.options.getString('formato') as GameFormat | null
    const result = removeGame(
        interaction.user.id,
        entry.titleKey,
        format ?? undefined
    )
    const messages = {
        ok: `🗑️ Quitaste **${entry.title}** de tu catálogo`,
        'not-found': `No tienes **${entry.title}**${format ? ` (${formatLabel(format)})` : ''}`,
        ambiguous: `Tienes **${entry.title}** físico y digital, elige el \`formato\``,
    }
    await send(interaction, messages[result], result !== 'ok')
}
