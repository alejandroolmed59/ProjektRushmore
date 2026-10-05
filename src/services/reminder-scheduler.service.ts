import { Client } from 'discord.js'
import { backupDb } from '../database/sqlite'
import {
    debtBatchMessage,
    monthlyBillTitle,
    nagTitle,
} from '../handlers/debts.handler'
import { DebtBatch, runDueMonthlyCharges, takeDueNags } from './debts.service'

const TICK_MS = 60 * 1000

/**
 * Every minute: bill monthly charges that are due, nag open debts whose
 * interval has passed, and take the daily DB backup. All schedule state lives
 * in SQLite, so restarts and phone reboots just resume on the next tick.
 */
export const startReminderScheduler = (client: Client): void => {
    let running = false
    const tick = async () => {
        if (running) return // a slow Discord call shouldn't stack ticks
        running = true
        try {
            const now = Date.now()
            for (const batch of runDueMonthlyCharges(now)) {
                if (batch.debts.length > 0)
                    await post(client, batch, monthlyBillTitle(batch.charge))
            }
            for (const batch of takeDueNags(now)) {
                await post(client, batch, nagTitle(batch.charge))
            }
            backupDb()
        } catch (e) {
            console.log('[reminders] tick failed:', e)
        } finally {
            running = false
        }
    }
    void tick()
    setInterval(() => void tick(), TICK_MS)
    console.log('[reminders] scheduler started')
}

const post = async (
    client: Client,
    batch: DebtBatch,
    title: string
): Promise<void> => {
    try {
        const channel = await client.channels.fetch(batch.charge.channel_id)
        if (!channel?.isSendable()) {
            console.log(
                `[reminders] channel ${batch.charge.channel_id} not sendable; skipping ${batch.charge.id}`
            )
            return
        }
        await channel.send(debtBatchMessage(batch, title))
    } catch (e) {
        console.log(`[reminders] failed to post for ${batch.charge.id}:`, e)
    }
}
