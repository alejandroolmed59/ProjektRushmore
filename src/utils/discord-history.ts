import {
    APIChannel,
    APIMessage,
    APIThreadList,
    ChannelType,
    REST,
    Routes,
} from 'discord.js'

// Channel types that hold a normal message history.
const HISTORY_TYPES = new Set<ChannelType>([
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildVoice,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.AnnouncementThread,
])

// Channels whose threads (or forum posts) we look up archived threads in.
const THREAD_PARENT_TYPES = new Set<ChannelType>([
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
    ChannelType.GuildMedia,
])

export const channelName = (channel: APIChannel): string =>
    (channel as { name?: string }).name ?? channel.id

const parentId = (channel: APIChannel): string | null =>
    (channel as { parent_id?: string | null }).parent_id ?? null

/** All archived threads of one parent channel, of one visibility, paged. */
const listArchivedThreads = async (
    rest: REST,
    channelId: string,
    visibility: 'public' | 'private'
): Promise<APIChannel[]> => {
    const threads: APIChannel[] = []
    let before: string | undefined
    for (;;) {
        const query = new URLSearchParams({ limit: '100' })
        if (before) query.set('before', before)
        let page: APIThreadList & { has_more?: boolean }
        try {
            page = (await rest.get(
                Routes.channelThreads(channelId, visibility),
                {
                    query,
                }
            )) as APIThreadList & { has_more?: boolean }
        } catch (e) {
            // Private archived threads need Manage Threads; skip what we can't see.
            const status = (e as { status?: number }).status
            if (status === 403 || status === 404) return threads
            throw e
        }
        threads.push(...page.threads)
        const last = page.threads[page.threads.length - 1] as
            | { thread_metadata?: { archive_timestamp: string } }
            | undefined
        const next = last?.thread_metadata?.archive_timestamp
        if (!page.has_more || !next) return threads
        before = next
    }
}

/**
 * Every channel and thread (active or archived, including forum posts) with a
 * message history. When `onlyIds` is given, keep those channels plus the
 * threads under them; IDs of categories or forums select their children.
 */
export const listTextChannels = async (
    rest: REST,
    guildId: string,
    onlyIds: string[] = []
): Promise<APIChannel[]> => {
    const channels = (await rest.get(
        Routes.guildChannels(guildId)
    )) as APIChannel[]
    const active = (await rest.get(
        Routes.guildActiveThreads(guildId)
    )) as APIThreadList

    const archived: APIChannel[] = []
    for (const parent of channels) {
        if (!THREAD_PARENT_TYPES.has(parent.type)) continue
        archived.push(
            ...(await listArchivedThreads(rest, parent.id, 'public')),
            ...(await listArchivedThreads(rest, parent.id, 'private'))
        )
    }

    const all = [...channels, ...active.threads, ...archived]
    const byId = new Map(all.map((c) => [c.id, c]))
    const selected = (c: APIChannel): boolean => {
        if (onlyIds.length === 0) return true
        // Walk up: thread -> channel/forum -> category.
        for (let id: string | null = c.id; id; ) {
            if (onlyIds.includes(id)) return true
            const current = byId.get(id)
            id = current ? parentId(current) : null
        }
        return false
    }

    const unknown = onlyIds.filter((id) => !byId.has(id))
    if (unknown.length > 0)
        console.log(`Ignoring unknown channel IDs: ${unknown.join(', ')}`)

    return [...byId.values()].filter(
        (c) => HISTORY_TYPES.has(c.type) && selected(c)
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
        const last = batch[batch.length - 1]
        if (!last) return
        yield batch
        before = last.id
    }
}
