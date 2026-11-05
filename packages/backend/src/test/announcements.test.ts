import { api, internal } from '@nxt/backend/api'
import { afterEach, expect, test, vi } from 'vitest'

import { createTestBackend, seedCommunity, type TestBackend } from '../testing'

const discord = { platform: 'discord', platformId: 'guild-1' } as const
const twitch = { platform: 'twitch', platformId: 'broadcaster-1' } as const

afterEach(() => {
    vi.useRealTimers()
})

async function seedShared(
    links: {
        platform: 'discord' | 'twitch'
        platformId: string
        enabled?: boolean
        commandChannelId?: string
    }[] = [discord, twitch]
) {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'open', links })
    return backend
}

async function joinFrom(
    backend: TestBackend,
    link: { platform: 'discord' | 'twitch'; platformId: string },
    user: string,
    channelId?: string
) {
    await backend.mutation(internal.platformQueue.join, {
        link,
        platformUserId: user,
        username: user,
        ...(channelId ? { channelId } : {}),
    })
}

function pending(backend: TestBackend, platform: 'discord' | 'twitch') {
    return backend.query(internal.announcements.pending, { platform })
}

test('pinging N Participants announces each on their own platform and platform space', async () => {
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    await joinFrom(backend, twitch, 'bob')
    await joinFrom(backend, discord, 'cy', 'chan-cy')

    await backend.mutation(internal.platformQueue.ping, {
        link: twitch,
        count: 3,
    })

    const forDiscord = await pending(backend, 'discord')
    const forTwitch = await pending(backend, 'twitch')
    expect(forDiscord.map(({ id: _id, ...rest }) => rest)).toEqual([
        {
            kind: 'pinged',
            action: 'post',
            platformId: 'guild-1',
            channelId: 'chan-ada',
            participant: {
                platformUserId: 'ada',
                username: 'ada',
                reference: 1,
            },
        },
        {
            kind: 'pinged',
            action: 'post',
            platformId: 'guild-1',
            channelId: 'chan-cy',
            participant: { platformUserId: 'cy', username: 'cy', reference: 3 },
        },
    ])
    expect(forTwitch.map(({ id: _id, ...rest }) => rest)).toEqual([
        {
            kind: 'pinged',
            action: 'post',
            platformId: 'broadcaster-1',
            channelId: 'broadcaster-1',
            participant: {
                platformUserId: 'bob',
                username: 'bob',
                reference: 2,
            },
        },
    ])
})

test('a dashboard ping announces exactly as a chat ping does', async () => {
    const backend = await seedShared()
    await joinFrom(backend, twitch, 'bob')

    await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.queue.ping, { count: 1 })

    const forTwitch = await pending(backend, 'twitch')
    expect(forTwitch).toEqual([
        expect.objectContaining({
            action: 'post',
            channelId: 'broadcaster-1',
            participant: {
                platformUserId: 'bob',
                username: 'bob',
                reference: 1,
            },
        }),
    ])
})

test('the Command channel wins over the channel the Participant last used', async () => {
    const backend = await seedShared([
        { ...discord, commandChannelId: 'commands' },
    ])
    await joinFrom(backend, discord, 'ada', 'chan-ada')

    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
    })

    expect(await pending(backend, 'discord')).toEqual([
        expect.objectContaining({ action: 'post', channelId: 'commands' }),
    ])
})

test('Announcements for a disabled Platform Link are to be dropped, not posted', async () => {
    const backend = await seedShared([discord, { ...twitch, enabled: false }])
    await backend.run(async (ctx) => {
        const queue = await ctx.db.query('queues').first()
        if (!queue) throw new Error('no queue')
        await ctx.db.insert('participants', {
            queueId: queue._id,
            reference: 1,
            username: 'bob',
            platform: 'twitch',
            platformUserId: 'bob',
            status: 'waiting',
        })
    })

    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
    })

    const forTwitch = await pending(backend, 'twitch')
    expect(forTwitch).toEqual([{ action: 'drop', id: expect.any(String) }])

    await backend.mutation(internal.announcements.markDropped, {
        id: forTwitch[0]!.id,
    })
    expect(await pending(backend, 'twitch')).toEqual([])
})

test('Announcements for a Platform Link removed after the ping are to be dropped', async () => {
    const backend = await seedShared()
    await joinFrom(backend, twitch, 'bob')
    await backend.mutation(internal.platformQueue.ping, {
        link: twitch,
        count: 1,
    })

    await backend.run(async (ctx) => {
        const link = await ctx.db
            .query('platformLinks')
            .withIndex('byPlatform', (q) =>
                q.eq('platform', 'twitch').eq('platformId', 'broadcaster-1')
            )
            .first()
        if (link) await ctx.db.delete('platformLinks', link._id)
    })

    expect(await pending(backend, 'twitch')).toEqual([
        { action: 'drop', id: expect.any(String) },
    ])
})

test('marking an Announcement delivered removes it from pending, and repeating is harmless', async () => {
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    await joinFrom(backend, discord, 'cy', 'chan-cy')
    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 2,
    })
    const [first] = await pending(backend, 'discord')

    await backend.mutation(internal.announcements.markDelivered, {
        id: first!.id,
    })
    await backend.mutation(internal.announcements.markDelivered, {
        id: first!.id,
    })

    expect(await pending(backend, 'discord')).toEqual([
        expect.objectContaining({
            participant: { platformUserId: 'cy', username: 'cy', reference: 2 },
        }),
    ])
})

test('dropPendingForLink drops only that Platform Link’s pending Announcements', async () => {
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    await joinFrom(backend, twitch, 'bob')
    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 2,
    })

    const { dropPendingForLink } = await import('../model/announcement')
    const dropped = await backend.run(async (ctx) => {
        const community = await ctx.db.query('communities').first()
        if (!community) throw new Error('no community')
        return await dropPendingForLink(ctx, community._id, twitch)
    })

    expect(dropped).toBe(1)
    expect(await pending(backend, 'twitch')).toEqual([])
    expect(await pending(backend, 'discord')).toHaveLength(1)
})

test('moving a Pinged Participant to Playing drops their pending Announcement', async () => {
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.queue.ping, { count: 1 })

    await owner.mutation(api.queue.play, { reference: 1 })

    expect(await pending(backend, 'discord')).toEqual([])
})

test('a Pinged Participant who leaves has their pending Announcement dropped', async () => {
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.queue.ping, { count: 1 })

    await backend.mutation(internal.platformQueue.leave, {
        link: discord,
        platformUserId: 'ada',
    })

    expect(await pending(backend, 'discord')).toEqual([])
})

test('returning a Participant and pinging them again owes them one Announcement', async () => {
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.queue.ping, { count: 1 })

    await owner.mutation(api.queue.returnToQueue, { reference: 1 })
    expect(await pending(backend, 'discord')).toEqual([])

    await owner.mutation(api.queue.ping, { count: 1 })
    expect(await pending(backend, 'discord')).toHaveLength(1)
})

test('dropping one Participant’s Announcement leaves other Participants’ pending', async () => {
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    await joinFrom(backend, discord, 'cy', 'chan-cy')
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.queue.ping, { count: 2 })

    await owner.mutation(api.queue.play, { reference: 1 })

    expect(await pending(backend, 'discord')).toEqual([
        expect.objectContaining({
            participant: { platformUserId: 'cy', username: 'cy', reference: 2 },
        }),
    ])
})

test('the dashboard view shows when a Pinged Participant’s pending Announcement was created', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'))
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    await joinFrom(backend, twitch, 'bob')
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.queue.ping, { count: 2 })
    const [forAda] = await pending(backend, 'discord')
    await backend.mutation(internal.announcements.markDelivered, {
        id: forAda!.id,
    })

    const view = await owner.query(api.queue.view, {})

    const pinged = view?.pinged.map((p) => [
        p.username,
        p.announcementPendingSince === undefined
            ? undefined
            : Math.floor(p.announcementPendingSince / 1000),
    ])
    expect(pinged).toEqual([
        ['ada', undefined],
        ['bob', Date.parse('2026-11-01T00:00:00Z') / 1000],
    ])
})

test('the scheduled prune deletes settled Announcements after a day', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'))
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    await joinFrom(backend, discord, 'cy', 'chan-cy')
    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 2,
    })
    const [first] = await pending(backend, 'discord')
    await backend.mutation(internal.announcements.markDelivered, {
        id: first!.id,
    })

    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'))
    expect(await backend.mutation(internal.announcements.prune, {})).toEqual({
        pruned: 0,
    })

    vi.setSystemTime(new Date('2026-11-02T01:00:00Z'))
    expect(await backend.mutation(internal.announcements.prune, {})).toEqual({
        pruned: 1,
    })
})

test('the scheduled prune keeps pending Announcements for a day, then drops them', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'))
    const backend = await seedShared()
    await joinFrom(backend, discord, 'ada', 'chan-ada')
    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
    })

    vi.setSystemTime(new Date('2026-11-01T23:00:00Z'))
    await backend.mutation(internal.announcements.prune, {})
    expect(await pending(backend, 'discord')).toHaveLength(1)

    vi.setSystemTime(new Date('2026-11-02T01:00:00Z'))
    await backend.mutation(internal.announcements.prune, {})
    expect(await pending(backend, 'discord')).toEqual([])
})

test('prune is registered as a cron job', async () => {
    const { default: crons } = await import('../functions/crons')
    expect(Object.values(crons.crons).map((job) => job.name)).toContain(
        'announcements:prune'
    )
})
