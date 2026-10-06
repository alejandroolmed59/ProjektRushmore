import {
    ChatInputCommandInteraction,
    Guild,
    Interaction,
    Message,
    MessageFlags,
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    User,
} from 'discord.js'
import {
    emojiStatsSince,
    recordReactions,
    recordTypedEmojis,
    removeReaction,
    renderEmoji,
    serverTopEmojis,
    toEmojiRef,
    totalsForEmojis,
    userTopEmojis,
    userTopReceived,
} from '../services/emoji.service'

// ---------- live tracking (best-effort: stats must never break the bot) ----------

export const trackMessageEmojis = (message: Message): void => {
    if (message.author.bot || !message.inGuild()) return
    try {
        recordTypedEmojis(
            {
                messageId: message.id,
                channelId: message.channelId,
                authorId: message.author.id,
                createdAt: message.createdTimestamp,
            },
            message.content
        )
    } catch (e) {
        console.log('[emojis] failed to record message:', e)
    }
}

/** `message` is the reacted message, already fetched if it arrived partial. */
export const trackReactionAdd = async (
    reaction: MessageReaction | PartialMessageReaction,
    message: Message,
    user: User | PartialUser
): Promise<void> => {
    try {
        // An uncached reactor arrives partial with `bot` unknown (null).
        const reactor = user.partial ? await user.fetch() : user
        if (reactor.bot) return
        const emoji = toEmojiRef(reaction.emoji)
        if (!emoji || !message.inGuild()) return
        recordReactions(
            {
                messageId: message.id,
                channelId: message.channelId,
                authorId: message.author.id,
                createdAt: message.createdTimestamp,
            },
            emoji,
            [user.id],
            Date.now()
        )
    } catch (e) {
        console.log('[emojis] failed to record reaction:', e)
    }
}

export const trackReactionRemove = (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): void => {
    const emoji = toEmojiRef(reaction.emoji)
    if (!emoji) return
    try {
        removeReaction(reaction.message.id, user.id, emoji.key)
    } catch (e) {
        console.log('[emojis] failed to remove reaction:', e)
    }
}

// ---------- /emojis ----------

const LEAST_USED_LIMIT = 10

/**
 * The server's own custom emojis with the fewest uses, including ones nobody
 * has used at all (which the usage table can't know about on its own).
 */
const leastUsedSection = (guild: Guild): string => {
    const emojis = [...guild.emojis.cache.values()]
    if (emojis.length === 0) return ''
    const totals = totalsForEmojis(emojis.map((e) => e.id))
    const ranked = emojis
        .map((e) => ({
            emoji_key: e.id,
            emoji_name: e.name ?? e.id,
            animated: e.animated ? 1 : 0,
            total: totals.get(e.id) ?? 0,
        }))
        .sort(
            (a, b) =>
                a.total - b.total || a.emoji_name.localeCompare(b.emoji_name)
        )
    const shown = ranked.slice(0, LEAST_USED_LIMIT)
    const unusedNotShown = ranked
        .slice(LEAST_USED_LIMIT)
        .filter((e) => e.total === 0).length
    const lines = shown.map(
        (e, i) => `**${i + 1}.** ${renderEmoji(e)} ×${e.total}`
    )
    if (unusedNotShown > 0)
        lines.push(`…y ${unusedNotShown} más que nadie ha usado`)
    return `💤 **Emojis del server menos usados**\n${lines.join('\n')}\n`
}

/** Handles /emojis. Returns true when it took the interaction. */
export const handleEmojiInteraction = async (
    interaction: Interaction
): Promise<boolean> => {
    if (
        !interaction.isChatInputCommand() ||
        interaction.commandName !== 'emojis'
    )
        return false
    try {
        await showEmojiStats(interaction)
    } catch (e) {
        console.log('[emojis] /emojis failed:', e)
        if (!interaction.replied && !interaction.deferred)
            await interaction
                .reply({
                    content: 'No pude cargar las estadísticas de emojis 😵',
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => undefined)
    }
    return true
}

const showEmojiStats = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    if (!interaction.inCachedGuild()) {
        await interaction.reply('Los comandos solo funcionan en server')
        return
    }

    const user = interaction.options.getUser('usuario')
    const { total, since } = emojiStatsSince()
    if (total === 0) {
        await interaction.reply('Todavía no tengo emojis registrados 🫥')
        return
    }
    const footer = `-# ${total} usos registrados desde <t:${Math.floor((since ?? Date.now()) / 1000)}:D>`

    if (!user) {
        const lines = serverTopEmojis().map(
            (e, i) => `**${i + 1}.** ${renderEmoji(e)} ×${e.total}`
        )
        await interaction.reply({
            content:
                `🏆 **Emojis más usados del server**\n${lines.join('\n')}\n\n` +
                `${leastUsedSection(interaction.guild)}\n${footer}`,
            allowedMentions: { parse: [] },
        })
        return
    }

    const used = userTopEmojis(user.id)
    const received = userTopReceived(user.id)
    if (used.length === 0 && received.length === 0) {
        await interaction.reply({
            content: `<@${user.id}> no ha usado emojis todavía`,
            allowedMentions: { parse: [] },
        })
        return
    }
    const usedLine = used.map((e) => `${renderEmoji(e)} ×${e.total}`).join('  ')
    const receivedLine = received
        .map((e) => `${renderEmoji(e)} ×${e.total}`)
        .join('  ')
    await interaction.reply({
        content:
            `📊 **Emojis de <@${user.id}>**\n` +
            `Más usa: ${usedLine || '—'}\n` +
            `Más le reaccionan: ${receivedLine || '—'}\n${footer}`,
        allowedMentions: { parse: [] },
    })
}
