import { api, internal } from '@nxt/backend/api'
import { expect, test, vi } from 'vitest'

import { isAnnouncementFailed } from '../failedAnnouncement'
import {
    createTestBackend,
    pairDeck,
    readActivityLog,
    readQueue,
    seedCommunity,
    type TestBackend,
} from '../testing'

async function seed() {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [
            {
                platform: 'discord',
                platformId: 'guild-1',
                commandChannelId: 'queue-channel',
            },
            { platform: 'twitch', platformId: 'broadcaster-1' },
        ],
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'notified' },
            {
                platformUserId: 't-bob',
                username: 'bob',
                status: 'playing',
                platform: 'twitch',
            },
            {
                platformUserId: 't-cy',
                username: 'cy',
                status: 'notified',
                platform: 'twitch',
            },
            { platformUserId: 'd-dee', username: 'dee', status: 'waiting' },
            { platformUserId: 'd-eve', username: 'eve', status: 'waiting' },
        ],
    })
    await seedCommunity(backend, {
        ownerId: 'owner-2',
        state: 'paused',
        participants: [
            { platformUserId: 'd-zed', username: 'zed', status: 'waiting' },
        ],
    })
    return backend
}

async function revokeOnlyDeck(backend: TestBackend, ownerId: string) {
    const owner = backend.withIdentity({ subject: ownerId })
    const [deck] = await owner.query(api.pairedDecks.list, {})
    if (!deck) throw new Error('no Paired deck')
    await owner.mutation(api.pairedDecks.revoke, { id: deck.id })
}

test('the deck view shows the owner’s Queue in join order', async () => {
    const backend = await seed()
    const secret = await pairDeck(backend, 'owner-1')

    expect(await backend.query(api.deck.view, { secret })).toEqual({
        kind: 'ok',
        state: 'open',
        waitingCount: 2,
        pinged: [
            {
                reference: 1,
                name: 'ada',
                platform: 'discord',
                announcementPendingSince: null,
            },
            {
                reference: 3,
                name: 'cy',
                platform: 'twitch',
                announcementPendingSince: null,
            },
        ],
        playing: [{ reference: 2, name: 'bob', platform: 'twitch' }],
    })
})

test('an unknown or revoked secret sees an unpaired view', async () => {
    const backend = await seed()
    const secret = await pairDeck(backend, 'owner-1')

    expect(
        await backend.query(api.deck.view, { secret: 'nxtd_unknown' })
    ).toEqual({ kind: 'unpaired' })

    await revokeOnlyDeck(backend, 'owner-1')

    expect(await backend.query(api.deck.view, { secret })).toEqual({
        kind: 'unpaired',
    })
})

test('a deck Ping calls the front of the Queue with the Saved ping note', async () => {
    vi.useFakeTimers()
    try {
        vi.setSystemTime(1_700_000_000_000)
        const backend = await seed()
        const secret = await pairDeck(backend, 'owner-1')
        await backend
            .withIdentity({ subject: 'owner-1' })
            .mutation(api.communities.setSavedPingNote, { note: 'Join VC' })

        expect(
            await backend.mutation(api.deck.ping, { secret, count: 1 })
        ).toMatchObject({ kind: 'ok', pinged: [{ username: 'dee' }] })

        const view = await backend.query(api.deck.view, { secret })
        if (view.kind !== 'ok') throw new Error('unpaired')
        expect(view.waitingCount).toBe(1)
        expect(view.pinged.map((slot) => slot.name)).toEqual([
            'ada',
            'cy',
            'dee',
        ])
        const since = view.pinged[2]?.announcementPendingSince ?? null
        expect(isAnnouncementFailed(since, Date.now() + 29_000)).toBe(false)
        expect(isAnnouncementFailed(since, Date.now() + 31_000)).toBe(true)
        expect(
            isAnnouncementFailed(
                view.pinged[0]?.announcementPendingSince ?? null,
                Date.now() + 60_000
            )
        ).toBe(false)

        expect(
            await backend.query(internal.announcements.pending, {
                platform: 'discord',
            })
        ).toMatchObject([
            {
                action: 'post',
                participant: { username: 'dee' },
                note: 'Join VC',
            },
        ])
        expect(await readActivityLog(backend, 'owner-1')).toEqual([
            {
                event: 'pinged',
                username: 'dee',
                platform: 'discord',
                platformUserId: 'd-dee',
            },
        ])
    } finally {
        vi.useRealTimers()
    }
})

test('deck Turn commands match the dashboard’s results and Activity log', async () => {
    const viaDeck = await seed()
    const viaDashboard = await seed()
    const secret = await pairDeck(viaDeck, 'owner-1')
    const owner = viaDashboard.withIdentity({ subject: 'owner-1' })

    const deckResults = [
        await viaDeck.mutation(api.deck.play, { secret, reference: 1 }),
        await viaDeck.mutation(api.deck.returnToQueue, {
            secret,
            reference: 3,
        }),
        await viaDeck.mutation(api.deck.done, { secret, reference: 2 }),
    ]
    const dashboardResults = [
        await owner.mutation(api.queue.play, { reference: 1 }),
        await owner.mutation(api.queue.returnToQueue, { reference: 3 }),
        await owner.mutation(api.queue.done, { reference: 2 }),
    ]

    expect(deckResults).toEqual(dashboardResults)
    expect(deckResults[0]).toMatchObject({
        kind: 'ok',
        participant: { reference: 1, username: 'ada' },
    })
    expect(await readQueue(viaDeck, 'owner-1')).toEqual(
        await readQueue(viaDashboard, 'owner-1')
    )
    expect(await readActivityLog(viaDeck, 'owner-1')).toEqual([
        {
            event: 'returned_to_queue',
            username: 'cy',
            platform: 'twitch',
            platformUserId: 't-cy',
        },
        {
            event: 'finished',
            username: 'bob',
            platform: 'twitch',
            platformUserId: 't-bob',
        },
    ])
})

test('a press on a stale reference gives wrong_state or unknown_reference', async () => {
    const backend = await seed()
    const secret = await pairDeck(backend, 'owner-1')

    // Someone else already moved ada to Playing.
    await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.queue.play, { reference: 1 })

    expect(
        await backend.mutation(api.deck.play, { secret, reference: 1 })
    ).toEqual({ kind: 'wrong_state', status: 'playing' })
    expect(
        await backend.mutation(api.deck.returnToQueue, { secret, reference: 1 })
    ).toEqual({ kind: 'wrong_state', status: 'playing' })

    await backend.mutation(api.deck.done, { secret, reference: 1 })
    expect(
        await backend.mutation(api.deck.done, { secret, reference: 1 })
    ).toEqual({ kind: 'unknown_reference' })
})

test('the deck opens and pauses the Queue', async () => {
    const backend = await seed()
    const secret = await pairDeck(backend, 'owner-1')

    expect(await backend.mutation(api.deck.pause, { secret })).toEqual({
        kind: 'ok',
    })
    expect(await backend.mutation(api.deck.pause, { secret })).toEqual({
        kind: 'already',
    })
    expect(await backend.query(api.deck.view, { secret })).toMatchObject({
        state: 'paused',
    })
    expect(await backend.mutation(api.deck.open, { secret })).toEqual({
        kind: 'ok',
    })
    expect((await readQueue(backend, 'owner-1'))?.state).toBe('open')
})

test('a revoked or unknown secret is refused and changes nothing', async () => {
    const backend = await seed()
    const secret = await pairDeck(backend, 'owner-1')
    await revokeOnlyDeck(backend, 'owner-1')
    const before = await readQueue(backend, 'owner-1')

    for (const key of [secret, 'nxtd_unknown', '']) {
        expect(await backend.mutation(api.deck.pause, { secret: key })).toEqual(
            { kind: 'unpaired' }
        )
        expect(
            await backend.mutation(api.deck.ping, { secret: key, count: 1 })
        ).toEqual({ kind: 'unpaired' })
        expect(
            await backend.mutation(api.deck.play, { secret: key, reference: 1 })
        ).toEqual({ kind: 'unpaired' })
    }

    expect(await readQueue(backend, 'owner-1')).toEqual(before)
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('a deck Ping is clamped to 1–10', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        participants: Array.from({ length: 12 }, (_, i) => ({
            platformUserId: `d-${i + 1}`,
            username: `p${i + 1}`,
            status: 'waiting' as const,
        })),
    })
    const secret = await pairDeck(backend, 'owner-1')
    const pinged = async (count: number) => {
        const result = await backend.mutation(api.deck.ping, { secret, count })
        return result.kind === 'ok' ? result.pinged.length : result.kind
    }

    expect(await pinged(0)).toBe(1)
    expect(await pinged(-3)).toBe(1)
    expect(await pinged(25)).toBe(10)
    expect(await backend.query(api.deck.view, { secret })).toMatchObject({
        waitingCount: 0,
    })
})

test('a deck never affects another Community', async () => {
    const backend = await seed()
    const secret = await pairDeck(backend, 'owner-2')
    const owner1Before = await readQueue(backend, 'owner-1')

    expect(await backend.query(api.deck.view, { secret })).toEqual({
        kind: 'ok',
        state: 'paused',
        waitingCount: 1,
        pinged: [],
        playing: [],
    })
    // References 2–5 exist only in owner 1's Queue.
    for (const reference of [2, 3, 4, 5]) {
        expect(
            await backend.mutation(api.deck.play, { secret, reference })
        ).toEqual({ kind: 'unknown_reference' })
        expect(
            await backend.mutation(api.deck.done, { secret, reference })
        ).toEqual({ kind: 'unknown_reference' })
    }
    await backend.mutation(api.deck.open, { secret })
    await backend.mutation(api.deck.ping, { secret, count: 10 })

    expect(await readQueue(backend, 'owner-1')).toEqual(owner1Before)
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
    expect(
        (await readActivityLog(backend, 'owner-2')).map((e) => e.username)
    ).toEqual(['zed'])
})

test('last used updates on deck mutations, not on reads', async () => {
    vi.useFakeTimers()
    try {
        vi.setSystemTime(1_700_000_000_000)
        const backend = await seed()
        const secret = await pairDeck(backend, 'owner-1')
        const owner = backend.withIdentity({ subject: 'owner-1' })
        const lastUsed = async () =>
            (await owner.query(api.pairedDecks.list, {}))[0]?.lastUsedAt

        vi.setSystemTime(1_700_000_100_000)
        await backend.query(api.deck.view, { secret })
        expect(await lastUsed()).toBeNull()

        // A press that changes nothing still counts as use.
        await backend.mutation(api.deck.open, { secret })
        expect(await lastUsed()).toBe(1_700_000_100_000)

        vi.setSystemTime(1_700_000_200_000)
        await backend.mutation(api.deck.done, { secret, reference: 2 })
        expect(await lastUsed()).toBe(1_700_000_200_000)
    } finally {
        vi.useRealTimers()
    }
})
