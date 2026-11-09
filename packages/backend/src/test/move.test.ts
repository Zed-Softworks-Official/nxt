import { api, internal } from '@nxt/backend/api'
import { expect, test, vi } from 'vitest'

import {
    createTestBackend,
    pairDeck,
    type SeedParticipant,
    seedCommunity,
} from '../testing'

// Move (ADR-0008): an Admin changes a waiting Participant's Position. These
// tests only look at Positions and view order, never at order keys.

const discord = { platform: 'discord', platformId: 'guild-1' } as const

function waiting(username: string): SeedParticipant {
    return { platformUserId: `d-${username}`, username, status: 'waiting' }
}

// ada q-1, bob q-2, cat q-3, dan q-4, eve q-5, all waiting in that order.
async function seedFive(state: 'open' | 'paused' = 'open') {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state,
        links: [discord],
        participants: ['ada', 'bob', 'cat', 'dan', 'eve'].map(waiting),
    })
    return backend
}

function asOwner(backend: ReturnType<typeof createTestBackend>) {
    return backend.withIdentity({ subject: 'owner-1' })
}

async function waitingOrder(backend: ReturnType<typeof createTestBackend>) {
    const view = await asOwner(backend).query(api.queue.view, {})
    return view?.waiting.map((p) => p.username)
}

test('the owner moves a waiting Participant to a Position', async () => {
    const backend = await seedFive()

    const result = await asOwner(backend).mutation(api.queue.move, {
        reference: 5,
        to: { position: 2 },
    })

    expect(result).toEqual({
        kind: 'ok',
        participant: {
            reference: 5,
            username: 'eve',
            platform: 'discord',
            platformUserId: 'd-eve',
        },
        position: 2,
    })
    expect(await waitingOrder(backend)).toEqual([
        'ada',
        'eve',
        'bob',
        'cat',
        'dan',
    ])
})

test('the owner moves a Participant after another, and to the front', async () => {
    const backend = await seedFive()
    const owner = asOwner(backend)

    expect(
        await owner.mutation(api.queue.move, {
            reference: 1,
            to: { after: 3 },
        })
    ).toMatchObject({ kind: 'ok', position: 3 })
    expect(await waitingOrder(backend)).toEqual([
        'bob',
        'cat',
        'ada',
        'dan',
        'eve',
    ])

    expect(
        await owner.mutation(api.queue.move, {
            reference: 4,
            to: { toFront: true },
        })
    ).toMatchObject({ kind: 'ok', position: 1 })
    expect(await waitingOrder(backend)).toEqual([
        'dan',
        'bob',
        'cat',
        'ada',
        'eve',
    ])
})

test('a Position past the end moves the Participant to the back', async () => {
    const backend = await seedFive()

    expect(
        await asOwner(backend).mutation(api.queue.move, {
            reference: 2,
            to: { position: 99 },
        })
    ).toMatchObject({ kind: 'ok', position: 5 })
    expect(await waitingOrder(backend)).toEqual([
        'ada',
        'cat',
        'dan',
        'eve',
        'bob',
    ])
})

test('platforms move by Position, after a Participant, and to the front, while Paused', async () => {
    const backend = await seedFive('paused')
    const move = (reference: number, to: Record<string, unknown>) =>
        backend.mutation(internal.platformQueue.move, {
            link: discord,
            reference,
            to: to as { position: number },
        })

    expect(await move(5, { position: 1 })).toMatchObject({
        kind: 'ok',
        participant: { username: 'eve' },
        position: 1,
    })
    expect(await move(1, { after: 4 })).toMatchObject({
        kind: 'ok',
        position: 5,
    })
    expect(await move(3, { toFront: true })).toMatchObject({
        kind: 'ok',
        position: 1,
    })
    expect(await move(2, { position: 10 })).toMatchObject({
        kind: 'ok',
        position: 5,
    })

    const view = await backend.query(internal.platformQueue.view, {
        link: discord,
    })
    expect(view.kind === 'ok' && view.waiting.map((p) => p.username)).toEqual([
        'cat',
        'eve',
        'dan',
        'ada',
        'bob',
    ])
    expect(
        await backend.mutation(internal.platformQueue.move, {
            link: { platform: 'twitch', platformId: 'nobody' },
            reference: 1,
            to: { toFront: true },
        })
    ).toEqual({ kind: 'unlinked' })
})

test('moving a Pinged or Playing Participant is wrong_state; an unknown reference is unknown_reference', async () => {
    const backend = await seedFive()
    const owner = asOwner(backend)
    await owner.mutation(api.queue.ping, { count: 2 })
    await owner.mutation(api.queue.play, { reference: 2 })

    expect(
        await owner.mutation(api.queue.move, {
            reference: 1,
            to: { toFront: true },
        })
    ).toEqual({ kind: 'wrong_state', status: 'pinged' })
    expect(
        await backend.mutation(internal.platformQueue.move, {
            link: discord,
            reference: 2,
            to: { position: 1 },
        })
    ).toEqual({ kind: 'wrong_state', status: 'playing' })
    expect(
        await owner.mutation(api.queue.move, {
            reference: 42,
            to: { position: 1 },
        })
    ).toEqual({ kind: 'unknown_reference' })
    expect(await waitingOrder(backend)).toEqual(['cat', 'dan', 'eve'])
})

test('moving after a neighbour who is no longer waiting lands directly after their old place', async () => {
    const backend = await seedFive()
    const owner = asOwner(backend)

    // bob is Pinged during the drag: eve lands after bob's place, then bob
    // comes Back to his place ahead of her.
    await owner.mutation(api.queue.move, { reference: 2, to: { position: 1 } })
    await owner.mutation(api.queue.ping, { count: 1 })
    expect(
        await owner.mutation(api.queue.move, {
            reference: 5,
            to: { after: 2 },
        })
    ).toMatchObject({ kind: 'ok', position: 1 })
    await owner.mutation(api.queue.returnToQueue, { reference: 2 })
    expect(await waitingOrder(backend)).toEqual([
        'bob',
        'eve',
        'ada',
        'cat',
        'dan',
    ])
})

test('moving after a neighbour who has left lands after whoever joined just before them', async () => {
    const backend = await seedFive()

    // cat leaves during the drag: eve lands where cat was, after bob.
    await backend.mutation(internal.platformQueue.leave, {
        link: discord,
        platformUserId: 'd-cat',
    })
    expect(
        await asOwner(backend).mutation(api.queue.move, {
            reference: 5,
            to: { after: 3 },
        })
    ).toMatchObject({ kind: 'ok', position: 3 })
    expect(await waitingOrder(backend)).toEqual(['ada', 'bob', 'eve', 'dan'])
})

test('new joiners go to the back after Moves', async () => {
    const backend = await seedFive()
    const owner = asOwner(backend)
    await owner.mutation(api.queue.move, { reference: 1, to: { position: 99 } })
    await owner.mutation(api.queue.move, {
        reference: 5,
        to: { toFront: true },
    })

    expect(
        await backend.mutation(internal.platformQueue.join, {
            link: discord,
            platformUserId: 'd-fay',
            username: 'fay',
        })
    ).toEqual({ kind: 'ok', reference: 6 })
    expect(await waitingOrder(backend)).toEqual([
        'eve',
        'bob',
        'cat',
        'dan',
        'ada',
        'fay',
    ])
})

test('Back returns a Participant to the place they were moved to', async () => {
    const backend = await seedFive()
    const owner = asOwner(backend)
    await owner.mutation(api.queue.move, { reference: 4, to: { position: 2 } })
    await owner.mutation(api.queue.ping, { count: 2 })

    await owner.mutation(api.queue.returnToQueue, { reference: 4 })
    expect(await waitingOrder(backend)).toEqual(['dan', 'bob', 'cat', 'eve'])
})

test('Quick Ping, the deck Ping key, position and Clear follow Moves', async () => {
    const backend = await seedFive()
    const owner = asOwner(backend)
    await owner.mutation(api.queue.move, {
        reference: 4,
        to: { toFront: true },
    })
    await owner.mutation(api.queue.move, { reference: 2, to: { position: 99 } })
    // Queue: dan, ada, cat, eve, bob

    expect(
        await backend.query(internal.platformQueue.position, {
            link: discord,
            platformUserId: 'd-bob',
        })
    ).toEqual({ kind: 'waiting', position: 5, reference: 2 })

    const quick = await owner.mutation(api.queue.ping, { count: 1 })
    expect(quick.kind === 'ok' && quick.pinged.map((p) => p.username)).toEqual([
        'dan',
    ])

    const secret = await pairDeck(backend, 'owner-1')
    const deck = await backend.mutation(api.deck.ping, { secret, count: 2 })
    expect(deck.kind === 'ok' && deck.pinged.map((p) => p.username)).toEqual([
        'ada',
        'cat',
    ])

    expect(
        await backend.query(internal.platformQueue.position, {
            link: discord,
            platformUserId: 'd-bob',
        })
    ).toEqual({ kind: 'waiting', position: 2, reference: 2 })

    expect(await owner.mutation(api.queue.clear, {})).toEqual({
        kind: 'ok',
        cleared: 2,
    })
    expect(await waitingOrder(backend)).toEqual([])
})

test('many Moves into the same gap keep the order correct', async () => {
    const backend = await seedFive()
    const owner = asOwner(backend)
    const expected = ['ada', 'bob', 'cat', 'dan', 'eve']

    // Keep moving the back of the Queue to Position 2, which always lands in
    // the gap between the front and the previous mover.
    for (let i = 0; i < 80; i++) {
        const back = expected.pop() as string
        expected.splice(1, 0, back)
        const reference = ['ada', 'bob', 'cat', 'dan', 'eve'].indexOf(back) + 1
        expect(
            await owner.mutation(api.queue.move, {
                reference,
                to: { position: 2 },
            })
        ).toMatchObject({ kind: 'ok', position: 2 })
    }
    expect(await waitingOrder(backend)).toEqual(expected)
})

test('the order key backfill keeps existing rows in join order', async () => {
    vi.useFakeTimers()
    try {
        // Rows from before order keys, across two Communities, more than one
        // batch's worth.
        const backend = await seedFive()
        await seedCommunity(backend, {
            ownerId: 'owner-2',
            state: 'open',
            participants: ['zed', 'yan'].map(waiting),
        })

        await backend.mutation(
            internal.migrations.backfillParticipantOrderKeys,
            {
                batchSize: 2,
            }
        )
        await backend.finishAllScheduledFunctions(vi.runAllTimers)

        expect(await waitingOrder(backend)).toEqual([
            'ada',
            'bob',
            'cat',
            'dan',
            'eve',
        ])
        const other = await backend
            .withIdentity({ subject: 'owner-2' })
            .query(api.queue.view, {})
        expect(other?.waiting.map((p) => p.username)).toEqual(['zed', 'yan'])

        // Backfilled rows still order correctly with joins and Moves.
        await backend.mutation(internal.platformQueue.join, {
            link: discord,
            platformUserId: 'd-fay',
            username: 'fay',
        })
        await asOwner(backend).mutation(api.queue.move, {
            reference: 6,
            to: { after: 2 },
        })
        expect(await waitingOrder(backend)).toEqual([
            'ada',
            'bob',
            'fay',
            'cat',
            'dan',
            'eve',
        ])
    } finally {
        vi.useRealTimers()
    }
})
