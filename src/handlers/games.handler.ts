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
    jevMatchTitle,
    lendGame,
    listCatalog,
    listCopies,
    listLoans,
    listTitles,
    LoanWithGame,
    matchTitle,
    openLoan,
    removeGame,
    returnGame,
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
        // A deferred reply's visibility is fixed, so swap it for a private
        // follow-up rather than posting an error to the whole channel.
        if (ephemeral) {
            await interaction.deleteReply().catch(() => undefined)
            await interaction.followUp({
                content: text,
                allowedMentions: { parse: [] },
                flags: MessageFlags.Ephemeral,
            })
            return
        }
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
const date = (ms: number): string => `<t:${Math.floor(ms / 1000)}:D>`

/**
 * Turn what the user typed into a library title: exact or token match first,
 * then Jev for nicknames and typos. Replies and returns null when it's
 * unknown or still ambiguous. Commands that change data pass
 * `actOnGuess: false`: a Jev guess is only suggested, never acted on.
 */
const resolveTitle = async (
    interaction: ChatInputCommandInteraction,
    query: string,
    { actOnGuess }: { actOnGuess: boolean }
): Promise<TitleEntry | null> => {
    const entries = listTitles()
    const match = matchTitle(query, entries)
    if (match.kind === 'match') return match.entry

    // Jev can take longer than Discord's 3s reply window.
    if (!interaction.deferred) await interaction.deferReply()
    const candidates = match.kind === 'ambiguous' ? match.candidates : entries
    const picked = await jevMatchTitle(query, candidates)
    if (picked && actOnGuess) return picked
    if (picked) {
        await send(
            interaction,
            `¿Quisiste decir **${picked.title}**? Vuelve a correr el comando eligiéndolo de la lista`,
            true
        )
        return null
    }

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
        case 'prestar':
            return lend(interaction)
        case 'devolver':
            return giveBack(interaction)
        case 'prestamos':
            return showLoans(interaction)
    }
}

const copyLine = (game: Game): string => {
    const base = `• ${formatLabel(game.format)} de ${mention(game.owner_id)}`
    if (game.format === 'digital') return base
    const loan = openLoan(game.id)
    if (!loan) return `${base} · disponible`
    const note = loan.note ? ` · _${loan.note}_` : ''
    return `${base} → lo tiene ${mention(loan.borrower_id)} desde ${date(loan.lent_at)}${note}`
}

const whoHas = async (
    interaction: ChatInputCommandInteraction,
    query: string
): Promise<void> => {
    const entry = await resolveTitle(interaction, query, { actOnGuess: true })
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
        interaction.options.getString('titulo', true),
        { actOnGuess: false }
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
        lent: `**${entry.title}** está prestado, primero usa \`/juegos devolver\``,
    }
    await send(interaction, messages[result], result !== 'ok')
}

const lend = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const borrower = interaction.options.getUser('a', true)
    if (borrower.bot)
        return send(interaction, 'Los bots no juegan Switch 🤖', true)
    if (borrower.id === interaction.user.id)
        return send(interaction, 'No te puedes prestar a ti mismo', true)
    const entry = await resolveTitle(
        interaction,
        interaction.options.getString('titulo', true),
        { actOnGuess: false }
    )
    if (!entry) return

    const result = lendGame({
        ownerId: interaction.user.id,
        titleKey: entry.titleKey,
        borrowerId: borrower.id,
        note: interaction.options.getString('nota')?.trim() || null,
    })
    switch (result.status) {
        case 'ok':
            return send(
                interaction,
                `🤝 ${mention(interaction.user.id)} le prestó **${entry.title}** a ${mention(borrower.id)}`
            )
        case 'already-lent':
            return send(
                interaction,
                `**${entry.title}** ya lo tiene ${mention(result.loan.borrower_id)} desde ${date(result.loan.lent_at)}`,
                true
            )
        case 'digital-only':
            return send(
                interaction,
                'Los juegos digitales se prestan desde Nintendo, aquí solo los físicos',
                true
            )
        case 'not-owner':
            return send(
                interaction,
                `No tienes **${entry.title}**, solo el dueño lo puede prestar`,
                true
            )
    }
}

const giveBack = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const entry = await resolveTitle(
        interaction,
        interaction.options.getString('titulo', true),
        { actOnGuess: false }
    )
    if (!entry) return
    const result = returnGame({
        userId: interaction.user.id,
        titleKey: entry.titleKey,
    })
    switch (result.status) {
        case 'ok': {
            const { loan } = result
            return send(
                interaction,
                `📦 **${entry.title}** regresó con ${mention(loan.owner_id)} ` +
                    `(${mention(loan.borrower_id)} lo tuvo del ${date(loan.lent_at)} al ${date(loan.returned_at ?? Date.now())})`
            )
        }
        case 'not-found':
            return send(
                interaction,
                `No hay un préstamo abierto de **${entry.title}** donde seas dueño o lo tengas tú`,
                true
            )
        case 'ambiguous':
            return send(
                interaction,
                `Hay varios préstamos abiertos de **${entry.title}** contigo:\n` +
                    result.loans.map(loanLine).join('\n'),
                true
            )
    }
}

const loanLine = (loan: LoanWithGame): string => {
    const returned = loan.returned_at
        ? ` → devuelto ${date(loan.returned_at)}`
        : ''
    const note = loan.note ? ` · _${loan.note}_` : ''
    return (
        `${loan.returned_at ? '✅' : '🔁'} **${loan.title}** de ${mention(loan.owner_id)} → ` +
        `${mention(loan.borrower_id)} · ${date(loan.lent_at)}${returned}${note}`
    )
}

const showLoans = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const includeReturned = interaction.options.getBoolean('historial') ?? false
    const user = interaction.options.getUser('usuario')
    const loans = listLoans({
        includeReturned,
        ...(user ? { userId: user.id } : {}),
    })
    if (loans.length === 0)
        return send(
            interaction,
            includeReturned
                ? 'No hay préstamos registrados'
                : 'No hay juegos prestados ahora mismo',
            true
        )
    const title = includeReturned
        ? '📜 **Préstamos**'
        : '🔁 **Prestados ahora**'
    await send(interaction, `${title}\n${loans.map(loanLine).join('\n')}`)
}
