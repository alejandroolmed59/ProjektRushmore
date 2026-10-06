import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    Interaction,
    MessageFlags,
} from 'discord.js'
import {
    balancesFor,
    cancelMonthlyCharge,
    Charge,
    claimDebt,
    createMonthlyCharge,
    createOneOffCharge,
    DebtBatch,
    formatCents,
    listActiveMonthlyCharges,
    Member,
    ONE_OFF_PERIOD,
    parseAmountToCents,
    resolveClaim,
    splitEvenly,
    UnpaidDebt,
} from '../services/debts.service'

export const DEBT_COMMANDS = ['cobro-mensual', 'cuenta', 'deudas']
const BUTTON_PREFIX = 'rem:'
const DEFAULT_NAG_DAYS = 3
const MAX_MESSAGE_LENGTH = 1900

/** Handles reminder/debt commands and buttons. Returns true when it took the interaction. */
export const handleDebtsInteraction = async (
    interaction: Interaction
): Promise<boolean> => {
    const isDebtCommand =
        interaction.isChatInputCommand() &&
        DEBT_COMMANDS.includes(interaction.commandName)
    const isDebtButton =
        interaction.isButton() && interaction.customId.startsWith(BUTTON_PREFIX)
    if (!isDebtCommand && !isDebtButton) return false

    // Same rule as the other commands: server only, never DMs.
    if (!interaction.inCachedGuild()) {
        await replyEphemeral(
            interaction,
            'Los comandos solo funcionan en server'
        )
        return true
    }
    await runSafely(interaction, () =>
        interaction.isChatInputCommand()
            ? handleCommand(interaction)
            : handleButton(interaction)
    )
    return true
}

const runSafely = async (
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    fn: () => Promise<void>
): Promise<void> => {
    try {
        await fn()
    } catch (e) {
        console.log('[debts] interaction failed:', e)
        const content = `Error: ${e instanceof Error ? e.message : String(e)}`
        if (interaction.replied || interaction.deferred) return
        await interaction.reply({ content, flags: MessageFlags.Ephemeral })
    }
}

const replyEphemeral = (
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    content: string
) => interaction.reply({ content, flags: MessageFlags.Ephemeral })

// Charges are announced in REMINDERS_CHANNEL_ID when set, else where the
// command was run; later nags go to the same place.
const reminderChannelId = (interaction: ChatInputCommandInteraction): string =>
    process.env.REMINDERS_CHANNEL_ID || interaction.channelId

/** Unique user IDs from a string option like "@a @b @c", minus the creator. */
const parseMentions = (raw: string, excludeId: string): string[] => [
    ...new Set(
        [...raw.matchAll(/<@!?(\d{17,20})>/g)]
            .map((m) => m[1])
            .filter((id): id is string => !!id && id !== excludeId)
    ),
]

/** Bots can't press "Ya pagué", so a debt assigned to one never settles. */
const hasBotMention = async (
    interaction: ChatInputCommandInteraction,
    userIds: string[]
): Promise<boolean> => {
    const users = await Promise.all(
        userIds.map((id) =>
            interaction.client.users.fetch(id).catch(() => null)
        )
    )
    return users.some((user) => user?.bot)
}

const mention = (userId: string): string => `<@${userId}>`
const periodLabel = (period: string): string =>
    period === ONE_OFF_PERIOD ? '' : ` (${period})`

// ---------- commands ----------

const handleCommand = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    switch (interaction.commandName) {
        case 'cobro-mensual':
            switch (interaction.options.getSubcommand()) {
                case 'crear':
                    return createMonthly(interaction)
                case 'lista':
                    return listMonthly(interaction)
                case 'cancelar':
                    return cancelMonthly(interaction)
            }
            return
        case 'cuenta':
            return createBill(interaction)
        case 'deudas':
            return showBalances(interaction)
    }
}

const createMonthly = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const creditorId = interaction.user.id
    const name = interaction.options.getString('nombre', true)
    const amountCents = parseAmountToCents(
        interaction.options.getString('monto', true)
    )
    const users = parseMentions(
        interaction.options.getString('usuarios', true),
        creditorId
    )
    const dayOfMonth = interaction.options.getInteger('dia', true)
    const nagEveryDays =
        interaction.options.getInteger('cada-dias') ?? DEFAULT_NAG_DAYS

    if (amountCents === null)
        return void (await replyEphemeral(
            interaction,
            'Monto inválido, ejemplo: 3.50'
        ))
    if (users.length === 0)
        return void (await replyEphemeral(
            interaction,
            'Menciona al menos a un usuario (@usuario)'
        ))
    if (await hasBotMention(interaction, users))
        return void (await replyEphemeral(
            interaction,
            'No puedes cobrarle a un bot 🤖'
        ))

    const charge = createMonthlyCharge({
        name,
        creditorId,
        channelId: reminderChannelId(interaction),
        dayOfMonth,
        nagEveryDays,
        members: users.map((userId) => ({ userId, amountCents })),
    })

    await interaction.reply({
        content:
            `🔁 Cobro mensual **${name}** creado (id \`${charge.id}\`)\n` +
            `${users.map(mention).join(' ')} → ${formatCents(amountCents)} c/u el día ${dayOfMonth} de cada mes\n` +
            `Primer cobro: <t:${Math.floor(charge.next_run_at / 1000)}:F> · ` +
            `recordatorio cada ${nagEveryDays} día(s) hasta que paguen`,
        allowedMentions: { parse: [] },
    })
}

const listMonthly = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const charges = listActiveMonthlyCharges(interaction.user.id)
    if (charges.length === 0)
        return void (await replyEphemeral(
            interaction,
            'No tienes cobros mensuales activos'
        ))

    const lines = charges.map(
        (c) =>
            `\`${c.id}\` **${c.name}** · día ${c.day_of_month} · cada ${c.nag_every_days} día(s) · ` +
            `próximo <t:${Math.floor(c.next_run_at / 1000)}:D>`
    )
    await replyEphemeral(interaction, truncate(lines.join('\n')))
}

const cancelMonthly = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const id = interaction.options.getString('id', true).trim()
    const result = cancelMonthlyCharge(id, interaction.user.id)
    const messages = {
        ok: `Cobro \`${id}\` cancelado. Las deudas ya generadas siguen pendientes.`,
        'not-found': `No encontré un cobro mensual activo con id \`${id}\``,
        'not-owner': 'Solo quien creó el cobro puede cancelarlo',
    }
    await replyEphemeral(interaction, messages[result])
}

const createBill = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const creditorId = interaction.user.id
    const name = interaction.options.getString('nombre', true)
    const users = parseMentions(
        interaction.options.getString('usuarios', true),
        creditorId
    )
    const totalRaw = interaction.options.getString('total')
    const amountsRaw = interaction.options.getString('montos')
    const includeMe = interaction.options.getBoolean('incluirme') ?? true
    const nagEveryDays =
        interaction.options.getInteger('cada-dias') ?? DEFAULT_NAG_DAYS

    if (users.length === 0)
        return void (await replyEphemeral(
            interaction,
            'Menciona al menos a un usuario (@usuario)'
        ))
    if (await hasBotMention(interaction, users))
        return void (await replyEphemeral(
            interaction,
            'No puedes cobrarle a un bot 🤖'
        ))

    let members: Member[] | null
    if (amountsRaw) {
        members = pairAmounts(
            users,
            amountsRaw.split(',').map(parseAmountToCents)
        )
        if (!members)
            return void (await replyEphemeral(
                interaction,
                `Pon un monto por usuario en el mismo orden (${users.length}), ejemplo: 20,25.50,15`
            ))
    } else {
        const totalCents = totalRaw ? parseAmountToCents(totalRaw) : null
        if (totalCents === null)
            return void (await replyEphemeral(
                interaction,
                'Pon un `total` válido para dividir parejo, o `montos` por persona'
            ))
        // Debtors come first so they absorb any leftover cent, not the payer.
        const shares = splitEvenly(
            totalCents,
            users.length + (includeMe ? 1 : 0)
        )
        members = pairAmounts(users, shares.slice(0, users.length))
        if (!members || members.some((m) => m.amountCents === 0))
            return void (await replyEphemeral(
                interaction,
                'El total es muy pequeño para dividirlo entre tantas personas'
            ))
    }

    const batch = createOneOffCharge({
        name,
        creditorId,
        channelId: reminderChannelId(interaction),
        nagEveryDays,
        members,
    })
    const message = debtBatchMessage(
        batch,
        `🧾 **${name}** — pagado por ${mention(creditorId)}`,
        nagEveryDays
    )
    // Post the bill where its reminders will go, so the "Ya pagué" button and
    // the nags live in the same channel.
    if (batch.charge.channel_id !== interaction.channelId) {
        const channel = await interaction.client.channels
            .fetch(batch.charge.channel_id)
            .catch(() => null)
        if (channel?.isSendable()) {
            await channel.send(message)
            return void (await replyEphemeral(
                interaction,
                `Cuenta publicada en <#${channel.id}>`
            ))
        }
        console.log(
            `[debts] channel ${batch.charge.channel_id} not sendable; posting bill in place`
        )
    }
    await interaction.reply(message)
}

/** Pair each user with the amount at the same index; null if any is missing or invalid. */
const pairAmounts = (
    users: string[],
    amounts: (number | null)[]
): Member[] | null => {
    if (amounts.length !== users.length) return null
    const members: Member[] = []
    for (const [i, userId] of users.entries()) {
        const amountCents = amounts[i]
        if (amountCents == null) return null
        members.push({ userId, amountCents })
    }
    return members
}

const showBalances = async (
    interaction: ChatInputCommandInteraction
): Promise<void> => {
    const balances = balancesFor(interaction.user.id)
    if (balances.length === 0)
        return void (await replyEphemeral(
            interaction,
            'Estás a mano con todos 🎉'
        ))

    const describe = (d: UnpaidDebt): string =>
        `${d.charge_name}${periodLabel(d.period)} ${formatCents(d.amount_cents)}` +
        (d.status === 'claimed' ? ' ⏳' : '')

    const lines = balances.map((b) => {
        const who = mention(b.counterpartId)
        const headline =
            b.netCents > 0
                ? `${who} te debe **${formatCents(b.netCents)}**`
                : b.netCents < 0
                  ? `Le debes **${formatCents(-b.netCents)}** a ${who}`
                  : `${who} y tú están a mano`
        const details = [
            ...b.owedToMe.map((d) => `  ↳ te debe: ${describe(d)}`),
            ...b.iOwe.map((d) => `  ↳ le debes: ${describe(d)}`),
        ]
        return [headline, ...details].join('\n')
    })
    await replyEphemeral(
        interaction,
        truncate(
            `**Tus saldos** (⏳ = pago por confirmar)\n${lines.join('\n')}`
        )
    )
}

const truncate = (text: string): string =>
    text.length > MAX_MESSAGE_LENGTH
        ? `${text.slice(0, MAX_MESSAGE_LENGTH)}\n…`
        : text

// ---------- messages shared with the scheduler ----------

/**
 * Message listing who owes what for a charge period, pinging only the debtors,
 * with a "Ya pagué" button the debtors can press.
 */
export const debtBatchMessage = (
    batch: DebtBatch,
    title: string,
    nagEveryDays: number = batch.charge.nag_every_days
) => {
    const lines = batch.debts.map(
        (d) => `${mention(d.debtor_id)} → ${formatCents(d.amount_cents)}`
    )
    const button = new ButtonBuilder()
        .setCustomId(`${BUTTON_PREFIX}claim:${batch.charge.id}:${batch.period}`)
        .setLabel('Ya pagué ✅')
        .setStyle(ButtonStyle.Success)
    return {
        content:
            `${title}${periodLabel(batch.period)}\n${lines.join('\n')}\n` +
            `-# Te recuerdo cada ${nagEveryDays} día(s) hasta que ${mention(batch.charge.creditor_id)} confirme el pago`,
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(button),
        ],
        allowedMentions: { users: batch.debts.map((d) => d.debtor_id) },
    }
}

export const monthlyBillTitle = (charge: Charge): string =>
    `🔁 Toca pagar **${charge.name}** a ${mention(charge.creditor_id)}`

export const nagTitle = (charge: Charge): string =>
    `⏰ Recordatorio: siguen pendientes de **${charge.name}** para ${mention(charge.creditor_id)}`

// ---------- buttons ----------

const handleButton = async (interaction: ButtonInteraction): Promise<void> => {
    const [action, id = '', period = ''] = interaction.customId
        .slice(BUTTON_PREFIX.length)
        .split(':')
    switch (action) {
        case 'claim':
            return onClaim(interaction, id, period)
        case 'confirm':
        case 'reject':
            return onResolve(interaction, id, action === 'confirm')
    }
}

const onClaim = async (
    interaction: ButtonInteraction,
    chargeId: string,
    period: string
): Promise<void> => {
    const result = claimDebt(chargeId, period, interaction.user.id)
    if (!result.ok) {
        const messages = {
            'no-debt': 'No tienes deuda pendiente en este cobro',
            'already-claimed': 'Ya avisaste; falta que lo confirmen ⏳',
            'already-paid': 'Esto ya está pagado ✅',
        }
        return void (await replyEphemeral(interaction, messages[result.reason]))
    }

    const { debt, charge } = result
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`${BUTTON_PREFIX}confirm:${debt.id}`)
            .setLabel('Confirmar')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${BUTTON_PREFIX}reject:${debt.id}`)
            .setLabel('No me ha llegado')
            .setStyle(ButtonStyle.Danger)
    )
    await interaction.reply({
        content:
            `💸 ${mention(debt.debtor_id)} dice que le pagó ${formatCents(debt.amount_cents)} ` +
            `de **${charge.name}**${periodLabel(debt.period)} a ${mention(debt.creditor_id)}. ¿Confirmas?`,
        components: [row],
        allowedMentions: { users: [debt.creditor_id] },
    })
}

const onResolve = async (
    interaction: ButtonInteraction,
    debtId: string,
    confirm: boolean
): Promise<void> => {
    const result = resolveClaim(debtId, interaction.user.id, confirm)
    if (!result.ok) {
        const messages = {
            'not-found': 'No encontré esa deuda',
            'not-creditor': 'Solo a quien le deben puede confirmar este pago',
            'not-claimed': 'Este pago ya fue resuelto',
        }
        return void (await replyEphemeral(interaction, messages[result.reason]))
    }

    const { debt, charge } = result
    const what = `${formatCents(debt.amount_cents)} de **${charge.name}**${periodLabel(debt.period)}`
    // Replace the confirm/reject prompt so its buttons can't be pressed twice.
    await interaction.update({
        content: confirm
            ? `✅ ${mention(debt.creditor_id)} confirmó el pago de ${mention(debt.debtor_id)}: ${what}`
            : `❌ Pago de ${mention(debt.debtor_id)} no confirmado: ${what}`,
        components: [],
        allowedMentions: { parse: [] },
    })
    // Edits never ping, so tell the debtor in a fresh message.
    if (!confirm) {
        await interaction.followUp({
            content: `${mention(debt.debtor_id)}, ${mention(debt.creditor_id)} dice que no le ha llegado tu pago de ${what}. Sigue pendiente.`,
            allowedMentions: { users: [debt.debtor_id] },
        })
    }
}
