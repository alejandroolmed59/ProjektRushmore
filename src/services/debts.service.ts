import { getDb, transaction } from '../database/sqlite'
import { GenerateId, GenerateLongerId } from '../utils/id-generator'

const DAY_MS = 24 * 60 * 60 * 1000

// Reminders fire at a fixed local hour. El Salvador is UTC-6 with no DST, so a
// constant offset is exact.
const LOCAL_UTC_OFFSET_HOURS = -6
const REMINDER_LOCAL_HOUR = 10

export const ONE_OFF_PERIOD = 'once'

export type ChargeKind = 'monthly' | 'oneoff'
export type DebtStatus = 'open' | 'claimed' | 'paid'

export type Charge = {
    id: string
    kind: ChargeKind
    name: string
    creditor_id: string
    channel_id: string
    nag_every_days: number
    day_of_month: number | null
    next_run_at: number | null
    active: number
    created_at: number
}

export type Debt = {
    id: string
    charge_id: string
    period: string
    debtor_id: string
    creditor_id: string
    amount_cents: number
    status: DebtStatus
    next_nag_at: number | null
    created_at: number
    paid_at: number | null
}

/** A monthly charge row; the queries that return these filter out NULL schedules. */
export type MonthlyCharge = Charge & {
    kind: 'monthly'
    day_of_month: number
    next_run_at: number
}

export type Member = { userId: string; amountCents: number }

export type DebtBatch = { charge: Charge; period: string; debts: Debt[] }

// ---------- money ----------

/** Split evenly; leftover cents go to the first shares so the sum is exact. */
export const splitEvenly = (totalCents: number, parts: number): number[] => {
    const base = Math.floor(totalCents / parts)
    const remainder = totalCents - base * parts
    return Array.from(
        { length: parts },
        (_, i) => base + (i < remainder ? 1 : 0)
    )
}

// ---------- time ----------

const toLocal = (ms: number): Date =>
    new Date(ms + LOCAL_UTC_OFFSET_HOURS * 60 * 60 * 1000)

const localToUtcMs = (
    year: number,
    monthIndex: number,
    day: number,
    hour: number
): number =>
    Date.UTC(year, monthIndex, day, hour) -
    LOCAL_UTC_OFFSET_HOURS * 60 * 60 * 1000

/**
 * Next time a monthly charge on `dayOfMonth` (1-28) fires strictly after
 * `afterMs`, at REMINDER_LOCAL_HOUR local time.
 */
export const nextMonthlyRunAt = (
    dayOfMonth: number,
    afterMs: number
): number => {
    const local = toLocal(afterMs)
    const year = local.getUTCFullYear()
    const month = local.getUTCMonth()
    const thisMonth = localToUtcMs(year, month, dayOfMonth, REMINDER_LOCAL_HOUR)
    return thisMonth > afterMs
        ? thisMonth
        : localToUtcMs(year, month + 1, dayOfMonth, REMINDER_LOCAL_HOUR)
}

/** "2026-11" for the local month containing `ms`. */
export const periodFor = (ms: number): string =>
    toLocal(ms).toISOString().slice(0, 7)

// ---------- charges ----------

export const createMonthlyCharge = (input: {
    name: string
    creditorId: string
    channelId: string
    dayOfMonth: number
    nagEveryDays: number
    members: Member[]
    now?: number
}): MonthlyCharge => {
    const now = input.now ?? Date.now()
    const charge: MonthlyCharge = {
        id: newChargeId(),
        kind: 'monthly',
        name: input.name,
        creditor_id: input.creditorId,
        channel_id: input.channelId,
        nag_every_days: input.nagEveryDays,
        day_of_month: input.dayOfMonth,
        next_run_at: nextMonthlyRunAt(input.dayOfMonth, now),
        active: 1,
        created_at: now,
    }
    transaction(() => {
        insertCharge(charge)
        const insertMember = getDb().prepare(
            'INSERT INTO charge_members (charge_id, user_id, amount_cents) VALUES (?, ?, ?)'
        )
        input.members.forEach((m) =>
            insertMember.run(charge.id, m.userId, m.amountCents)
        )
    })
    return charge
}

/** A bill split right now: creates the charge and its debts in one go. */
export const createOneOffCharge = (input: {
    name: string
    creditorId: string
    channelId: string
    nagEveryDays: number
    members: Member[]
    now?: number
}): DebtBatch => {
    const now = input.now ?? Date.now()
    const charge: Charge = {
        id: newChargeId(),
        kind: 'oneoff',
        name: input.name,
        creditor_id: input.creditorId,
        channel_id: input.channelId,
        nag_every_days: input.nagEveryDays,
        day_of_month: null,
        next_run_at: null,
        active: 1,
        created_at: now,
    }
    const debts = transaction(() => {
        insertCharge(charge)
        return insertDebts(charge, ONE_OFF_PERIOD, input.members, now)
    })
    return { charge, period: ONE_OFF_PERIOD, debts }
}

/**
 * Charge IDs are short so people can type them into /cobro-mensual cancelar,
 * which makes collisions likely over time; draw until one is free.
 */
const newChargeId = (): string => {
    for (;;) {
        const id = GenerateId()
        if (!getCharge(id)) return id
    }
}

const insertCharge = (c: Charge): void => {
    getDb()
        .prepare(
            `INSERT INTO charges (id, kind, name, creditor_id, channel_id, nag_every_days,
                day_of_month, next_run_at, active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            c.id,
            c.kind,
            c.name,
            c.creditor_id,
            c.channel_id,
            c.nag_every_days,
            c.day_of_month,
            c.next_run_at,
            c.active,
            c.created_at
        )
}

/** Insert one debt per member; skips members already billed for this period. */
const insertDebts = (
    charge: Charge,
    period: string,
    members: Member[],
    now: number
): Debt[] => {
    const insert = getDb().prepare(
        `INSERT OR IGNORE INTO debts (id, charge_id, period, debtor_id, creditor_id,
            amount_cents, status, next_nag_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`
    )
    const created: Debt[] = []
    for (const m of members) {
        const debt: Debt = {
            id: GenerateLongerId(),
            charge_id: charge.id,
            period,
            debtor_id: m.userId,
            creditor_id: charge.creditor_id,
            amount_cents: m.amountCents,
            status: 'open',
            next_nag_at: now + charge.nag_every_days * DAY_MS,
            created_at: now,
            paid_at: null,
        }
        const result = insert.run(
            debt.id,
            debt.charge_id,
            debt.period,
            debt.debtor_id,
            debt.creditor_id,
            debt.amount_cents,
            debt.next_nag_at,
            debt.created_at
        )
        if (result.changes > 0) created.push(debt)
    }
    return created
}

export const getCharge = (id: string): Charge | undefined =>
    getDb().prepare('SELECT * FROM charges WHERE id = ?').get(id) as
        | Charge
        | undefined

export const getChargeMembers = (chargeId: string): Member[] =>
    (
        getDb()
            .prepare(
                'SELECT user_id, amount_cents FROM charge_members WHERE charge_id = ?'
            )
            .all(chargeId) as { user_id: string; amount_cents: number }[]
    ).map((r) => ({ userId: r.user_id, amountCents: r.amount_cents }))

// Matches the MonthlyCharge type: rows without a schedule are never returned.
const MONTHLY_SCHEDULED = `kind = 'monthly' AND active = 1
    AND day_of_month IS NOT NULL AND next_run_at IS NOT NULL`

export const listActiveMonthlyCharges = (creditorId: string): MonthlyCharge[] =>
    getDb()
        .prepare(
            `SELECT * FROM charges WHERE ${MONTHLY_SCHEDULED} AND creditor_id = ?
             ORDER BY created_at`
        )
        .all(creditorId) as MonthlyCharge[]

/** Stop future billing. Debts already created stay until settled. */
export const cancelMonthlyCharge = (
    id: string,
    userId: string
): 'ok' | 'not-found' | 'not-owner' => {
    const charge = getCharge(id)
    if (!charge || charge.kind !== 'monthly' || !charge.active)
        return 'not-found'
    if (charge.creditor_id !== userId) return 'not-owner'
    getDb().prepare('UPDATE charges SET active = 0 WHERE id = ?').run(id)
    return 'ok'
}

// ---------- scheduler ----------

/**
 * Bill every monthly charge whose run time has passed and advance it to the
 * next upcoming run. If the bot was down across several run dates, it bills
 * once (for the first missed period) instead of back-filling every one.
 *
 * Each charge commits on its own, so one that fails is logged and retried next
 * tick without hiding the batches that did commit (they still need announcing).
 */
export const runDueMonthlyCharges = (now: number = Date.now()): DebtBatch[] => {
    const due = getDb()
        .prepare(
            `SELECT * FROM charges WHERE ${MONTHLY_SCHEDULED} AND next_run_at <= ?`
        )
        .all(now) as MonthlyCharge[]

    const batches: DebtBatch[] = []
    for (const charge of due) {
        try {
            batches.push(
                transaction(() => {
                    const period = periodFor(charge.next_run_at)
                    const debts = insertDebts(
                        charge,
                        period,
                        getChargeMembers(charge.id),
                        now
                    )
                    getDb()
                        .prepare(
                            'UPDATE charges SET next_run_at = ? WHERE id = ?'
                        )
                        .run(
                            nextMonthlyRunAt(charge.day_of_month, now),
                            charge.id
                        )
                    return { charge, period, debts }
                })
            )
        } catch (e) {
            console.log(`[debts] failed to bill charge ${charge.id}:`, e)
        }
    }
    return batches
}

/**
 * Open debts whose nag time has passed, grouped per charge+period so one
 * message can mention everyone who still owes. Pushes each debt's next nag
 * forward before returning, so a failed post skips one nag rather than spamming.
 */
export const takeDueNags = (now: number = Date.now()): DebtBatch[] => {
    const debts = getDb()
        .prepare(
            `SELECT * FROM debts WHERE status = 'open' AND next_nag_at <= ?
             ORDER BY charge_id, period`
        )
        .all(now) as Debt[]
    if (debts.length === 0) return []

    const batches = new Map<string, DebtBatch>()
    transaction(() => {
        const bump = getDb().prepare(
            'UPDATE debts SET next_nag_at = ? WHERE id = ?'
        )
        for (const debt of debts) {
            const key = `${debt.charge_id}:${debt.period}`
            let batch = batches.get(key)
            if (!batch) {
                const charge = getCharge(debt.charge_id)
                if (!charge) continue
                batch = { charge, period: debt.period, debts: [] }
                batches.set(key, batch)
            }
            batch.debts.push(debt)
            bump.run(now + batch.charge.nag_every_days * DAY_MS, debt.id)
        }
    })
    return [...batches.values()]
}

// ---------- payment flow ----------

export type ClaimResult =
    | { ok: true; debt: Debt; charge: Charge }
    | { ok: false; reason: 'no-debt' | 'already-claimed' | 'already-paid' }

/** Debtor says "I paid": open -> claimed, pending the creditor's confirmation. */
export const claimDebt = (
    chargeId: string,
    period: string,
    userId: string
): ClaimResult => {
    const debt = getDb()
        .prepare(
            'SELECT * FROM debts WHERE charge_id = ? AND period = ? AND debtor_id = ?'
        )
        .get(chargeId, period, userId) as Debt | undefined
    const charge = getCharge(chargeId)
    if (!debt || !charge) return { ok: false, reason: 'no-debt' }
    if (debt.status === 'claimed')
        return { ok: false, reason: 'already-claimed' }
    if (debt.status === 'paid') return { ok: false, reason: 'already-paid' }
    getDb()
        .prepare(`UPDATE debts SET status = 'claimed' WHERE id = ?`)
        .run(debt.id)
    return { ok: true, debt: { ...debt, status: 'claimed' }, charge }
}

export type ResolveResult =
    | { ok: true; debt: Debt; charge: Charge }
    | { ok: false; reason: 'not-found' | 'not-creditor' | 'not-claimed' }

/**
 * Creditor answers a claim: confirm marks it paid, reject reopens it and
 * schedules the next nag one interval from now.
 */
export const resolveClaim = (
    debtId: string,
    userId: string,
    confirm: boolean,
    now: number = Date.now()
): ResolveResult => {
    const debt = getDb()
        .prepare('SELECT * FROM debts WHERE id = ?')
        .get(debtId) as Debt | undefined
    const charge = debt && getCharge(debt.charge_id)
    if (!debt || !charge) return { ok: false, reason: 'not-found' }
    if (debt.creditor_id !== userId)
        return { ok: false, reason: 'not-creditor' }
    if (debt.status !== 'claimed') return { ok: false, reason: 'not-claimed' }

    if (confirm) {
        getDb()
            .prepare(
                `UPDATE debts SET status = 'paid', paid_at = ? WHERE id = ?`
            )
            .run(now, debtId)
        return {
            ok: true,
            debt: { ...debt, status: 'paid', paid_at: now },
            charge,
        }
    }
    const nextNag = now + charge.nag_every_days * DAY_MS
    getDb()
        .prepare(
            `UPDATE debts SET status = 'open', next_nag_at = ? WHERE id = ?`
        )
        .run(nextNag, debtId)
    return {
        ok: true,
        debt: { ...debt, status: 'open', next_nag_at: nextNag },
        charge,
    }
}

// ---------- balances ----------

export type UnpaidDebt = Debt & { charge_name: string }

export type Balance = {
    counterpartId: string
    /** Positive: they owe you. Negative: you owe them. */
    netCents: number
    owedToMe: UnpaidDebt[]
    iOwe: UnpaidDebt[]
}

/** Everything unpaid between `userId` and each counterpart, netted Splitwise-style. */
export const balancesFor = (userId: string): Balance[] => {
    const rows = getDb()
        .prepare(
            `SELECT d.*, c.name AS charge_name FROM debts d JOIN charges c ON c.id = d.charge_id
             WHERE d.status != 'paid' AND (d.creditor_id = ? OR d.debtor_id = ?)
             ORDER BY d.created_at`
        )
        .all(userId, userId) as UnpaidDebt[]

    const byCounterpart = new Map<string, Balance>()
    for (const debt of rows) {
        const owedToMe = debt.creditor_id === userId
        const counterpartId = owedToMe ? debt.debtor_id : debt.creditor_id
        let balance = byCounterpart.get(counterpartId)
        if (!balance) {
            balance = { counterpartId, netCents: 0, owedToMe: [], iOwe: [] }
            byCounterpart.set(counterpartId, balance)
        }
        if (owedToMe) {
            balance.owedToMe.push(debt)
            balance.netCents += debt.amount_cents
        } else {
            balance.iOwe.push(debt)
            balance.netCents -= debt.amount_cents
        }
    }
    return [...byCounterpart.values()].sort(
        (a, b) => Math.abs(b.netCents) - Math.abs(a.netCents)
    )
}
