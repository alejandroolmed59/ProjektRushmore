import { APIChannel, APIMessage, ChannelType, REST, Routes } from 'discord.js'

// Channel types that hold a normal message history.
const TEXT_TYPES = new Set<ChannelType>([
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildVoice,
])

export const channelName = (channel: APIChannel): string =>
    (channel as { name?: string }).name ?? channel.id

/** The guild's text channels, or just `onlyIds` when given. */
export const listTextChannels = async (
    rest: REST,
    guildId: string,
    onlyIds: string[] = []
): Promise<APIChannel[]> => {
    const channels = (await rest.get(
        Routes.guildChannels(guildId)
    )) as APIChannel[]
    return channels.filter((c) =>
        onlyIds.length > 0 ? onlyIds.includes(c.id) : TEXT_TYPES.has(c.type)
    )
}

/**
 * Page a channel's history newest-first in batches of 100, starting before
 * `before` when resuming. Uses REST only, so no gateway session is opened.
 */
export async function* pageChannelHistory(
    rest: REST,
    channelId: string,
    before?: string
): AsyncGenerator<APIMessage[]> {
    for (;;) {
        const query = new URLSearchParams({ limit: '100' })
        if (before) query.set('before', before)
        const batch = (await rest.get(Routes.channelMessages(channelId), {
            query,
        })) as APIMessage[]
        if (batch.length === 0) return
        yield batch
        before = batch[batch.length - 1]!.id
    }
}

export const parseIdList = (raw: string | undefined): string[] =>
    (raw ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
