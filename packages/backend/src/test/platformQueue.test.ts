import { internal } from '@nxt/backend/api'
import { expect, test } from 'vitest'

import {
    createTestBackend,
    readActivityLog,
    readQueue,
    seedCommunity,
} from '../testing'

const discord = { platform: 'discord', platformId: 'guild-1' } as const
const twitch = { platform: 'twitch', platformId: 'broadcaster-1' } as const

async function seedShared(state: 'open' | 'paused' = 'open') {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state,
        links: [discord, twitch],
    })
    return backend
}

test('joining from any linked platform hands out increasing references', async () => {
    const backend = await seedShared()

    const ada = await backend.mutation(internal.platformQueue.join, {
        link: discord,
        platformUserId: 'd-ada',
        username: 'ada',
    })
    const bob = await backend.mutation(internal.platformQueue.join, {
        link: twitch,
        platformUserId: 't-bob',
        username: 'bob',
    })

    expect(ada).toEqual({ kind: 'ok', reference: 1 })
    expect(bob).toEqual({ kind: 'ok', reference: 2 })
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                reference: 1,
                username: 'ada',
                platform: 'discord',
                platformUserId: 'd-ada',
                status: 'waiting',
            },
            {
                reference: 2,
                username: 'bob',
                platform: 'twitch',
                platformUserId: 't-bob',
                status: 'waiting',
            },
        ],
    })
})

test('leaving and joining again gives a new reference', async () => {
    const backend = await seedShared()
    const who = { link: twitch, platformUserId: 't-bob', username: 'bob' }

    await backend.mutation(internal.platformQueue.join, who)
    const left = await backend.mutation(internal.platformQueue.leave, {
        link: twitch,
        platformUserId: 't-bob',
    })
    const again = await backend.mutation(internal.platformQueue.join, who)

    expect(left).toEqual({ kind: 'ok', reference: 1 })
    expect(again).toEqual({ kind: 'ok', reference: 2 })
})

test('leaving when not in the Queue is absent', async () => {
    const backend = await seedShared()

    const result = await backend.mutation(internal.platformQueue.leave, {
        link: twitch,
        platformUserId: 't-nobody',
    })

    expect(result).toEqual({ kind: 'absent' })
})

test('joining twice is already, joining a Paused Queue is paused', async () => {
    const backend = await seedShared()
    const who = { link: discord, platformUserId: 'd-ada', username: 'ada' }
    await backend.mutation(internal.platformQueue.join, who)

    expect(await backend.mutation(internal.platformQueue.join, who)).toEqual({
        kind: 'already',
        reference: 1,
    })

    await backend.mutation(internal.platformQueue.pause, { link: discord })
    expect(
        await backend.mutation(internal.platformQueue.join, {
            link: twitch,
            platformUserId: 't-bob',
            username: 'bob',
        })
    ).toEqual({ kind: 'paused' })
})

test('the same platform user ID on another platform is a separate Participant', async () => {
    const backend = await seedShared()

    await backend.mutation(internal.platformQueue.join, {
        link: discord,
        platformUserId: 'same-id',
        username: 'ada',
    })
    const result = await backend.mutation(internal.platformQueue.join, {
        link: twitch,
        platformUserId: 'same-id',
        username: 'ada_tv',
    })

    expect(result).toEqual({ kind: 'ok', reference: 2 })
})

test('a disabled or unknown Platform Link is unlinked', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [{ ...twitch, enabled: false }],
    })

    expect(
        await backend.mutation(internal.platformQueue.join, {
            link: twitch,
            platformUserId: 't-bob',
            username: 'bob',
        })
    ).toEqual({ kind: 'unlinked' })
    expect(
        await backend.mutation(internal.platformQueue.open, {
            link: { platform: 'discord', platformId: 'nowhere' },
        })
    ).toEqual({ kind: 'unlinked' })
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('open and pause report when the Queue is already in that state', async () => {
    const backend = await seedShared('paused')

    expect(
        await backend.mutation(internal.platformQueue.open, { link: twitch })
    ).toEqual({ kind: 'ok' })
    expect(
        await backend.mutation(internal.platformQueue.open, { link: discord })
    ).toEqual({ kind: 'already' })
    expect(
        await backend.mutation(internal.platformQueue.pause, { link: discord })
    ).toEqual({ kind: 'ok' })
    expect(
        await backend.mutation(internal.platformQueue.pause, { link: twitch })
    ).toEqual({ kind: 'already' })
    expect((await readQueue(backend, 'owner-1'))?.state).toBe('paused')
})

async function seedWaiting() {
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

async function statuses(backend: ReturnType<typeof createTestBackend>) {
    const queue = await readQueue(backend, 'owner-1')
    return queue?.participants.map((p) => [p.reference, p.status])
}

test('ping calls the front of the Queue from every platform and logs it', async () => {
    const backend = await seedWaiting()

    const result = await backend.mutation(internal.platformQueue.ping, {
        link: twitch,
        count: 2,
    })

    expect(result).toEqual({
        kind: 'ok',
        pinged: [
            {
                reference: 1,
                username: 'ada',
                platform: 'discord',
                platformUserId: 'd-ada',
            },
            {
                reference: 2,
                username: 'bob',
                platform: 'twitch',
                platformUserId: 't-bob',
            },
        ],
    })
    expect(await statuses(backend)).toEqual([
        [1, 'notified'],
        [2, 'notified'],
        [3, 'waiting'],
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'pinged',
            username: 'ada',
            platform: 'discord',
            platformUserId: 'd-ada',
        },
        {
            event: 'pinged',
            username: 'bob',
            platform: 'twitch',
            platformUserId: 't-bob',
        },
    ])
})

test('ping on a Queue with nobody waiting is empty', async () => {
    const backend = await seedShared()

    expect(
        await backend.mutation(internal.platformQueue.ping, {
            link: discord,
            count: 1,
        })
    ).toEqual({ kind: 'empty' })
})

test('a reference survives ping, return, and play, and done ends it for good', async () => {
    const backend = await seedWaiting()
    const bob = {
        reference: 2,
        username: 'bob',
        platform: 'twitch',
        platformUserId: 't-bob',
    }

    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 2,
    })
    expect(
        await backend.mutation(internal.platformQueue.returnToQueue, {
            link: discord,
            reference: 2,
        })
    ).toEqual({ kind: 'ok', participant: bob })
    expect(await statuses(backend)).toEqual([
        [1, 'notified'],
        [2, 'waiting'],
        [3, 'waiting'],
    ])

    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
    })
    expect(
        await backend.mutation(internal.platformQueue.play, {
            link: discord,
            reference: 2,
        })
    ).toEqual({ kind: 'ok', participant: bob })
    expect(
        await backend.mutation(internal.platformQueue.done, {
            link: twitch,
            reference: 2,
        })
    ).toEqual({ kind: 'ok', participant: bob })
    expect(await statuses(backend)).toEqual([
        [1, 'notified'],
        [3, 'waiting'],
    ])

    expect(
        await backend.mutation(internal.platformQueue.play, {
            link: discord,
            reference: 2,
        })
    ).toEqual({ kind: 'unknown_reference' })
    const next = await backend.mutation(internal.platformQueue.join, {
        link: twitch,
        platformUserId: 't-bob',
        username: 'bob',
    })
    expect(next).toEqual({ kind: 'ok', reference: 4 })

    expect(
        (await readActivityLog(backend, 'owner-1')).map((e) => [
            e.event,
            e.username,
        ])
    ).toEqual([
        ['pinged', 'ada'],
        ['pinged', 'bob'],
        ['returned_to_queue', 'bob'],
        ['pinged', 'bob'],
        ['finished', 'bob'],
    ])
})

test('Turn commands in the wrong state are refused and change nothing', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [discord],
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'waiting' },
            { platformUserId: 'd-bob', username: 'bob', status: 'notified' },
            { platformUserId: 'd-cy', username: 'cy', status: 'playing' },
        ],
    })

    const attempt = (
        fn: 'play' | 'returnToQueue' | 'done',
        reference: number
    ) =>
        backend.mutation(internal.platformQueue[fn], {
            link: discord,
            reference,
        })

    expect(await attempt('play', 1)).toEqual({
        kind: 'wrong_state',
        status: 'waiting',
    })
    expect(await attempt('returnToQueue', 3)).toEqual({
        kind: 'wrong_state',
        status: 'playing',
    })
    expect(await attempt('done', 2)).toEqual({
        kind: 'wrong_state',
        status: 'pinged',
    })
    expect(await attempt('play', 3)).toEqual({
        kind: 'wrong_state',
        status: 'playing',
    })
    expect(await attempt('done', 99)).toEqual({ kind: 'unknown_reference' })
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
        [3, 'playing'],
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('references belong to one Community', async () => {
    const backend = await seedWaiting()
    await seedCommunity(backend, {
        ownerId: 'owner-2',
        state: 'open',
        links: [{ platform: 'discord', platformId: 'guild-2' }],
    })

    expect(
        await backend.mutation(internal.platformQueue.returnToQueue, {
            link: { platform: 'discord', platformId: 'guild-2' },
            reference: 1,
        })
    ).toEqual({ kind: 'unknown_reference' })
})

test('clear removes waiting Participants from every platform and keeps turns in progress', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'paused',
        links: [discord, twitch],
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'waiting' },
            {
                platformUserId: 't-bob',
                username: 'bob',
                status: 'waiting',
                platform: 'twitch',
            },
            { platformUserId: 'd-cy', username: 'cy', status: 'notified' },
            { platformUserId: 'd-di', username: 'di', status: 'playing' },
        ],
    })

    expect(
        await backend.mutation(internal.platformQueue.clear, { link: twitch })
    ).toEqual({ kind: 'ok', cleared: 2 })
    expect(await statuses(backend)).toEqual([
        [3, 'notified'],
        [4, 'playing'],
    ])
    expect(
        await backend.mutation(internal.platformQueue.clear, { link: discord })
    ).toEqual({ kind: 'empty' })
})

test('position counts only waiting Participants, across platforms', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'paused',
        links: [discord, twitch],
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'notified' },
            {
                platformUserId: 't-bob',
                username: 'bob',
                status: 'waiting',
                platform: 'twitch',
            },
            { platformUserId: 'd-cy', username: 'cy', status: 'waiting' },
            { platformUserId: 'd-di', username: 'di', status: 'playing' },
        ],
    })
    const position = (link: typeof discord | typeof twitch, id: string) =>
        backend.query(internal.platformQueue.position, {
            link,
            platformUserId: id,
        })

    expect(await position(discord, 'd-cy')).toEqual({
        kind: 'waiting',
        position: 2,
        reference: 3,
    })
    expect(await position(twitch, 't-bob')).toEqual({
        kind: 'waiting',
        position: 1,
        reference: 2,
    })
    expect(await position(discord, 'd-ada')).toEqual({
        kind: 'pinged',
        reference: 1,
    })
    expect(await position(discord, 'd-di')).toEqual({
        kind: 'playing',
        reference: 4,
    })
    expect(await position(discord, 't-bob')).toEqual({ kind: 'absent' })
})

test('view lists the Queue, Pinged, and Playing with references and platforms', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [discord, twitch],
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'notified' },
            {
                platformUserId: 't-bob',
                username: 'bob',
                status: 'waiting',
                platform: 'twitch',
            },
            { platformUserId: 'd-cy', username: 'cy', status: 'waiting' },
            { platformUserId: 'd-di', username: 'di', status: 'playing' },
        ],
    })

    const view = await backend.query(internal.platformQueue.view, {
        link: twitch,
    })

    const names = (list: Array<{ reference: number; platform: string }>) =>
        list.map((p) => [p.reference, p.platform])
    expect(view.kind).toBe('ok')
    if (view.kind !== 'ok') return
    expect(view.state).toBe('open')
    expect(names(view.waiting)).toEqual([
        [2, 'twitch'],
        [3, 'discord'],
    ])
    expect(names(view.pinged)).toEqual([[1, 'discord']])
    expect(names(view.playing)).toEqual([[4, 'discord']])
    expect(view.waiting[0]).toMatchObject({
        username: 'bob',
        platformUserId: 't-bob',
    })
})

test('view of a Community with no Queue yet is an empty Paused Queue', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'none',
        links: [twitch],
    })

    expect(
        await backend.query(internal.platformQueue.view, { link: twitch })
    ).toEqual({
        kind: 'ok',
        state: 'paused',
        waiting: [],
        pinged: [],
        playing: [],
    })
})
