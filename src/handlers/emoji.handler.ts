import {
    Interaction,
    Message,
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    User,
} from 'discord.js'
import {
    EmojiRef,
    emojiStatsSince,
    recordReactions,
    recordTypedEmojis,
    removeReaction,
    renderEmoji,
    serverTopEmojis,
    unicodeKey,
    userTopEmojis,
    userTopReceived,
} from '../services/emoji.service'

const toEmojiRef = (
    reaction: MessageReaction | PartialMessageReaction
): EmojiRef | null => {
    const { id, name, animated } = reaction.emoji
    if (id) return { key: id, name: name ?? id, animated: !!animated }
    return name ? { key: unicodeKey(name), name, animated: false } : null
}

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

export const trackReactionAdd = async (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): Promise<void> => {
    if (user.bot) return
    try {
        const emoji = toEmojiRef(reaction)
        // Reactions on old, uncached messages arrive without the author.
        const message = reaction.message.partial
            ? await reaction.message.fetch()
            : reaction.message
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
    const emoji = toEmojiRef(reaction)
    if (!emoji) return
    try {
        removeReaction(reaction.message.id, user.id, emoji.key)
    } catch (e) {
        console.log('[emojis] failed to remove reaction:', e)
    }
}

// ---------- /emojis ----------

/** Handles /emojis. Returns true when it took the interaction. */
export const handleEmojiInteraction = async (
    interaction: Interaction
): Promise<boolean> => {
    if (
        !interaction.isChatInputCommand() ||
        interaction.commandName !== 'emojis'
    )
        return false
    if (!interaction.inCachedGuild()) {
        await interaction.reply('Los comandos solo funcionan en server')
        return true
    }

    const user = interaction.options.getUser('usuario')
    const { total, since } = emojiStatsSince()
    if (total === 0) {
        await interaction.reply('Todavía no tengo emojis registrados 🫥')
        return true
    }
    const footer = `-# ${total} usos registrados desde <t:${Math.floor((since ?? Date.now()) / 1000)}:D>`

    if (!user) {
        const lines = serverTopEmojis().map(
            (e, i) => `**${i + 1}.** ${renderEmoji(e)} ×${e.total}`
        )
        await interaction.reply({
            content: `🏆 **Emojis más usados del server**\n${lines.join('\n')}\n${footer}`,
            allowedMentions: { parse: [] },
        })
        return true
    }

    const used = userTopEmojis(user.id)
    const received = userTopReceived(user.id)
    if (used.length === 0 && received.length === 0) {
        await interaction.reply({
            content: `<@${user.id}> no ha usado emojis todavía`,
            allowedMentions: { parse: [] },
        })
        return true
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
    return true
}
