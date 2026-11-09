import { api, internal } from '@nxt/backend/api'
import { expect, test } from 'vitest'

import {
    createTestBackend,
    readActivityLog,
    readQueue,
    seedCommunity,
} from '../testing'

const discord = { platform: 'discord', platformId: 'guild-1' } as const
const twitch = { platform: 'twitch', platformId: 'broadcaster-1' } as const

async function seedShared() {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [discord, twitch],
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'waiting' },
            {
                platformUserId: 't-bob',
                username: 'bob',
                status: 'waiting',
                platform: 'twitch',
            },
            { platformUserId: 'd-cy', username: 'cy', status: 'waiting' },
        ],
    })
    return backend
}

async function waitingUsernames(backend: ReturnType<typeof createTestBackend>) {
    return (await readQueue(backend, 'owner-1'))?.participants.map(
        (p) => p.username
    )
}

test('an Admin on one platform removes a waiting Participant from another', async () => {
    const backend = await seedShared()

    const result = await backend.mutation(internal.platformQueue.remove, {
        link: discord,
        reference: 2,
    })

    expect(result).toEqual({
        kind: 'ok',
        participant: {
            reference: 2,
            username: 'bob',
            platform: 'twitch',
            platformUserId: 't-bob',
        },
    })
    expect(await waitingUsernames(backend)).toEqual(['ada', 'cy'])
})

test('removing a Pinged Participant drops the Announcement still owed to them', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [discord, twitch],
    })
    await backend.mutation(internal.platformQueue.join, {
        link: discord,
        platformUserId: 'd-ada',
        username: 'ada',
        channelId: 'chan-ada',
    })
    await backend.mutation(internal.platformQueue.join, {
        link: discord,
        platformUserId: 'd-bob',
        username: 'bob',
        channelId: 'chan-bob',
    })
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.queue.ping, { count: 2 })

    const result = await backend.mutation(internal.platformQueue.remove, {
        link: twitch,
        reference: 1,
    })

    expect(result).toMatchObject({
        kind: 'ok',
        participant: { reference: 1, username: 'ada' },
    })
    const pending = await backend.query(internal.announcements.pending, {
        platform: 'discord',
    })
    expect(
        pending.map((a) =>
            a.action === 'post' ? a.participant.username : a.action
        )
    ).toEqual(['bob'])
    expect(await waitingUsernames(backend)).toEqual(['bob'])
})

test('the owner removes a Playing Participant while Paused, and nothing is logged', async () => {
    const backend = await seedShared()
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.queue.ping, { count: 1 })
    await owner.mutation(api.queue.play, { reference: 1 })
    await owner.mutation(api.queue.pause, {})
    const logBefore = await readActivityLog(backend, 'owner-1')

    const result = await owner.mutation(api.queue.remove, { reference: 1 })

    expect(result).toMatchObject({
        kind: 'ok',
        participant: { reference: 1, username: 'ada' },
    })
    const view = await owner.query(api.queue.view, {})
    expect(view?.playing).toEqual([])
    expect(view?.waiting.map((p) => p.username)).toEqual(['bob', 'cy'])
    expect(await readActivityLog(backend, 'owner-1')).toEqual(logBefore)
})

test('an unknown or finished reference gives unknown_reference', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [discord],
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'done' },
        ],
    })
    const owner = backend.withIdentity({ subject: 'owner-1' })

    expect(await owner.mutation(api.queue.remove, { reference: 42 })).toEqual({
        kind: 'unknown_reference',
    })
    expect(
        await backend.mutation(internal.platformQueue.remove, {
            link: discord,
            reference: 1,
        })
    ).toEqual({ kind: 'unknown_reference' })
})

test('a removed reference is not handed to a later joiner', async () => {
    const backend = await seedShared()
    await backend.mutation(internal.platformQueue.remove, {
        link: discord,
        reference: 3,
    })

    const again = await backend.mutation(internal.platformQueue.join, {
        link: discord,
        platformUserId: 'd-cy',
        username: 'cy',
    })

    expect(again).toEqual({ kind: 'ok', reference: 4 })
    expect(
        await backend.mutation(internal.platformQueue.remove, {
            link: discord,
            reference: 3,
        })
    ).toEqual({ kind: 'unknown_reference' })
})

test("one Community's Remove never affects another Community", async () => {
    const backend = await seedShared()
    await seedCommunity(backend, {
        ownerId: 'owner-2',
        state: 'open',
        links: [{ platform: 'discord', platformId: 'guild-2' }],
        participants: [
            { platformUserId: 'd-zed', username: 'zed', status: 'waiting' },
        ],
    })

    const fromOwner = await backend
        .withIdentity({ subject: 'owner-2' })
        .mutation(api.queue.remove, { reference: 2 })
    const fromLink = await backend.mutation(internal.platformQueue.remove, {
        link: { platform: 'discord', platformId: 'guild-2' },
        reference: 3,
    })

    expect(fromOwner).toEqual({ kind: 'unknown_reference' })
    expect(fromLink).toEqual({ kind: 'unknown_reference' })
    expect(await waitingUsernames(backend)).toEqual(['ada', 'bob', 'cy'])
})

test('Remove through a missing Platform Link is unlinked', async () => {
    const backend = await seedShared()

    expect(
        await backend.mutation(internal.platformQueue.remove, {
            link: { platform: 'discord', platformId: 'guild-unknown' },
            reference: 1,
        })
    ).toEqual({ kind: 'unlinked' })
    expect(await waitingUsernames(backend)).toEqual(['ada', 'bob', 'cy'])
})
