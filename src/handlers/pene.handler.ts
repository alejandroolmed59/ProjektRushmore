import {
    ChatInputCommandInteraction,
    Interaction,
    MessageFlags,
} from 'discord.js'
import { scannerBacklog } from '../scanners/runner'
import {
    peneStatsSince,
    topPeneUsers,
    userPeneStats,
} from '../services/pene.service'

// ---------- /ranking-pene ----------

/** Handles /ranking-pene. Returns true when it took the interaction. */
export const handlePeneInteraction = async (
    interaction: Interaction
): Promise<boolean> => {
    if (
        !interaction.isChatInputCommand() ||
        interaction.commandName !== 'ranking-pene'
    )
        return false
    try {
        await showPeneRanking(interaction)
    } catch (e) {
        console.log('[pene] /ranking-pene failed:', e)
        if (!interaction.replied && !interaction.deferred)
            await interaction
                .reply({
                    content: 'No pude cargar el ranking 😵',
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => undefined)
    }
    return true
}

const mentions = (n: number): string =>
    `${n} ${n === 1 ? 'mención' : 'menciones'}`

const showPeneRanking = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    if (!interaction.inCachedGuild()) {
        await interaction.reply('Los comandos solo funcionan en server')
        return
    }

    const { total, since } = peneStatsSince()
    const backlog = scannerBacklog('pene')
    const pending =
        backlog > 0
            ? `\n-# Todavía faltan ${backlog} mensajes por revisar ⏳`
            : ''
    if (total === 0) {
        await interaction.reply(`Nadie ha dicho nada todavía 😇${pending}`)
        return
    }
    const footer =
        `-# ${mentions(total)} en total desde <t:${Math.floor((since ?? Date.now()) / 1000)}:D>` +
        pending

    const user = interaction.options.getUser('usuario')
    if (!user) {
        const lines = topPeneUsers().map(
            (u, i) => `**${i + 1}.** <@${u.user_id}> — ${mentions(u.total)}`
        )
        await interaction.reply({
            content: `🍆 **Ranking de pene del server**\n${lines.join('\n')}\n\n${footer}`,
            allowedMentions: { parse: [] },
        })
        return
    }

    const stats = userPeneStats(user.id)
    if (stats.total === 0) {
        await interaction.reply({
            content: `<@${user.id}> no ha dicho nada todavía 😇`,
            allowedMentions: { parse: [] },
        })
        return
    }
    const words = stats.terms.map((t) => `${t.term} ×${t.total}`).join(' · ')
    await interaction.reply({
        content:
            `🍆 **<@${user.id}>**: ${mentions(stats.total)} (#${stats.rank} del server)\n` +
            `Palabras favoritas: ${words}\n${footer}`,
        allowedMentions: { parse: [] },
    })
}
