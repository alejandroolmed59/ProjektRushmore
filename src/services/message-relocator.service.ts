import {
    Message,
    Webhook,
    WebhookType,
    TextChannel,
    NewsChannel,
} from 'discord.js'
import { isFootballMessage } from './football-detector.service'

const WEBHOOK_NAME = 'shitpost-relocator'

type WebhookCapableChannel = TextChannel | NewsChannel

const canHostWebhook = (channel: unknown): channel is WebhookCapableChannel =>
    channel instanceof TextChannel || channel instanceof NewsChannel

/**
 * Reuse our relocator webhook on the channel if it exists, otherwise create it.
 */
const getOrCreateWebhook = async (
    channel: WebhookCapableChannel
): Promise<Webhook> => {
    const webhooks = await channel.fetchWebhooks()
    const existing = webhooks.find(
        (wh) =>
            wh.name === WEBHOOK_NAME &&
            wh.type === WebhookType.Incoming &&
            wh.token != null
    )
    if (existing) return existing
    return channel.createWebhook({ name: WEBHOOK_NAME })
}

/**
 * "Move" a message: repost its content in the target channel through a webhook
 * that mimics the author's name + avatar, then delete the original.
 *
 * Best-effort: on any failure we log and leave the original message in place
 * rather than risk deleting without a successful repost.
 */
export const relocateMessage = async (
    message: Message,
    targetChannelId: string
): Promise<void> => {
    try {
        const target = await message.client.channels.fetch(targetChannelId)
        if (!canHostWebhook(target)) {
            console.log(
                `[relocator] target channel ${targetChannelId} is not a webhook-capable text channel; skipping`
            )
            return
        }

        const webhook = await getOrCreateWebhook(target)

        // Forward attachment URLs inline (simplest); Discord CDN links from the
        // original message stay valid after deletion for already-uploaded files.
        const attachmentUrls = message.attachments.map((a) => a.url)
        const body = [message.content, ...attachmentUrls]
            .filter((part) => part.length > 0)
            .join('\n')

        if (body.length === 0) return

        await webhook.send({
            content: body,
            username: message.member?.displayName ?? message.author.username,
            avatarURL: message.author.displayAvatarURL(),
            allowedMentions: { parse: [] }, // don't re-ping anyone on the copy
        })

        await message.delete()
    } catch (e) {
        console.log(
            '[relocator] failed to relocate message, leaving original:',
            e
        )
    }
}

/**
 * Feature entry point for the message handler: if this message is a football
 * post from the watched user (and the feature is configured), relocate it.
 * Returns true when the message was handled so the caller can stop processing.
 *
 * Config lives here rather than in the handler so the hot path stays thin and
 * the whole "shitpost relocator" feature is self-contained.
 */
export const maybeRelocateFootballMessage = async (
    message: Message
): Promise<boolean> => {
    const watchedUserId = process.env.SHITPOST_USER_ID
    const targetChannelId = process.env.SHITPOST_TARGET_CHANNEL_ID
    if (
        !watchedUserId ||
        !targetChannelId ||
        message.author.id !== watchedUserId ||
        message.channelId === targetChannelId ||
        message.content.trim().length === 0
    ) {
        return false
    }

    if (!(await isFootballMessage(message.content))) return false

    await relocateMessage(message, targetChannelId)
    return true
}
