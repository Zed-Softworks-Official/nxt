import { api, internal } from '@nxt/backend/api'
import { expect, test } from 'vitest'

import {
    createTestBackend,
    readActivityLog,
    readQueue,
    seedCommunity,
    type TestBackend,
} from '../testing'

const discord = { platform: 'discord', platformId: 'guild-1' } as const
const twitch = { platform: 'twitch', platformId: 'broadcaster-1' } as const

async function seedWaiting(state: 'open' | 'paused' = 'open') {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state,
        links: [{ ...discord, commandChannelId: 'commands' }, twitch],
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

async function waitingInOrder(backend: TestBackend) {
    const view = await backend.query(internal.platformQueue.view, {
        link: discord,
    })
    if (view.kind !== 'ok') throw new Error('unlinked')
    return view.waiting.map((p) => p.username)
}

function pending(backend: TestBackend, platform: 'discord' | 'twitch') {
    return backend.query(internal.announcements.pending, { platform })
}

const bob = {
    reference: 2,
    username: 'bob',
    platform: 'twitch',
    platformUserId: 't-bob',
} as const

test('a targeted Ping calls a middle Participant, logs it, and announces them on their platform', async () => {
    const backend = await seedWaiting()

    const result = await backend.mutation(internal.platformQueue.pingOne, {
        link: discord,
        reference: 2,
    })

    expect(result).toEqual({ kind: 'ok', participant: bob })
    expect(
        (await readQueue(backend, 'owner-1'))?.participants.map((p) => [
            p.username,
            p.status,
        ])
    ).toEqual([
        ['ada', 'waiting'],
        ['bob', 'notified'],
        ['cy', 'waiting'],
    ])
    expect(await waitingInOrder(backend)).toEqual(['ada', 'cy'])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'pinged',
            username: 'bob',
            platform: 'twitch',
            platformUserId: 't-bob',
        },
    ])
    expect(await pending(backend, 'discord')).toEqual([])
    expect(await pending(backend, 'twitch')).toEqual([
        expect.objectContaining({
            kind: 'pinged',
            platformId: 'broadcaster-1',
            participant: {
                platformUserId: 't-bob',
                username: 'bob',
                reference: 2,
            },
        }),
    ])
})

async function pendingNotes(backend: TestBackend) {
    const rows = [
        ...(await pending(backend, 'discord')),
        ...(await pending(backend, 'twitch')),
    ]
    return rows.map((row) => (row.action === 'post' ? row.note : 'dropped'))
}

test('a targeted Ping uses the Saved ping note unless a note is typed', async () => {
    const backend = await seedWaiting()
    await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.communities.setSavedPingNote, { note: 'Join VC 2' })

    await backend.mutation(internal.platformQueue.pingOne, {
        link: discord,
        reference: 3,
    })
    await backend.mutation(internal.platformQueue.pingOne, {
        link: twitch,
        reference: 1,
        note: 'Lobby code ABCD',
    })

    expect(
        (await pending(backend, 'discord')).map((row) =>
            row.action === 'post'
                ? [row.participant.username, row.note]
                : 'dropped'
        )
    ).toEqual([
        ['cy', 'Join VC 2'],
        ['ada', 'Lobby code ABCD'],
    ])
})

test('a targeted Ping with a note that is too long changes nothing', async () => {
    const backend = await seedWaiting()

    expect(
        await backend.mutation(internal.platformQueue.pingOne, {
            link: discord,
            reference: 2,
            note: 'x'.repeat(201),
        })
    ).toEqual({ kind: 'note_too_long', max: 200 })
    expect(await waitingInOrder(backend)).toEqual(['ada', 'bob', 'cy'])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
    expect(await pendingNotes(backend)).toEqual([])
})

test('a targeted Ping of someone not waiting is wrong_state, and an unknown reference is unknown_reference', async () => {
    const backend = await seedWaiting()
    await backend.mutation(internal.platformQueue.pingOne, {
        link: discord,
        reference: 2,
    })
    await backend.mutation(internal.platformQueue.pingOne, {
        link: discord,
        reference: 3,
    })
    await backend.mutation(internal.platformQueue.play, {
        link: discord,
        reference: 3,
    })

    expect(
        await backend.mutation(internal.platformQueue.pingOne, {
            link: discord,
            reference: 2,
        })
    ).toEqual({ kind: 'wrong_state', status: 'pinged' })
    expect(
        await backend.mutation(internal.platformQueue.pingOne, {
            link: twitch,
            reference: 3,
        })
    ).toEqual({ kind: 'wrong_state', status: 'playing' })
    expect(
        await backend.mutation(internal.platformQueue.pingOne, {
            link: discord,
            reference: 42,
        })
    ).toEqual({ kind: 'unknown_reference' })
    expect(await waitingInOrder(backend)).toEqual(['ada'])
    expect(
        (await readActivityLog(backend, 'owner-1')).map((e) => e.event)
    ).toEqual(['pinged', 'pinged'])
})

test('the owner targets a Ping from the dashboard while the Queue is Paused', async () => {
    const backend = await seedWaiting('paused')
    const owner = backend.withIdentity({ subject: 'owner-1' })

    expect(await owner.mutation(api.queue.pingOne, { reference: 2 })).toEqual({
        kind: 'ok',
        participant: bob,
    })
    expect(await waitingInOrder(backend)).toEqual(['ada', 'cy'])
    expect(await pending(backend, 'twitch')).toHaveLength(1)
    expect(
        (await readActivityLog(backend, 'owner-1')).map((e) => [
            e.event,
            e.username,
        ])
    ).toEqual([['pinged', 'bob']])
})

test('a reference from another Community is unknown to a targeted Ping', async () => {
    const backend = await seedWaiting()
    await seedCommunity(backend, { ownerId: 'owner-2', state: 'open' })

    expect(
        await backend
            .withIdentity({ subject: 'owner-2' })
            .mutation(api.queue.pingOne, { reference: 1 })
    ).toEqual({ kind: 'unknown_reference' })
    expect(await waitingInOrder(backend)).toEqual(['ada', 'bob', 'cy'])
})

test('signed-out callers cannot target a Ping', async () => {
    const backend = await seedWaiting()

    await expect(
        backend.mutation(api.queue.pingOne, { reference: 2 })
    ).rejects.toThrow('Not signed in')
    expect(await waitingInOrder(backend)).toEqual(['ada', 'bob', 'cy'])
})
