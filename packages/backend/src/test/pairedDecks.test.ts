import { api, internal } from '@nxt/backend/api'
import { expect, test, vi } from 'vitest'

import {
    MAX_LIVE_PAIRINGS,
    markPairedDeckUsed,
    PAIRING_TTL_MS,
    resolvePairedDeck,
} from '../model/pairedDeck'
import {
    createTestBackend,
    pairDeck,
    seedCommunity,
    startPairing,
} from '../testing'

async function seed() {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'open' })
    await seedCommunity(backend, { ownerId: 'owner-2', state: 'open' })
    return backend
}

test('start → approve → poll hands the secret over exactly once', async () => {
    const backend = await seed()
    const owner = backend.withIdentity({ subject: 'owner-1' })

    const { code, pollToken } = await startPairing(backend)
    expect(code).toMatch(/^[A-Z0-9]{8}$/)

    expect(
        await backend.mutation(api.pairedDecks.pollPairing, { pollToken })
    ).toEqual({ kind: 'pending' })

    expect(
        await owner.mutation(api.pairedDecks.approvePairing, {
            code,
            name: 'Studio deck',
        })
    ).toEqual({ kind: 'ok' })

    const first = await backend.mutation(api.pairedDecks.pollPairing, {
        pollToken,
    })
    expect(first.kind).toBe('approved')
    if (first.kind !== 'approved') throw new Error('unreachable')
    expect(first.secret.length).toBeGreaterThanOrEqual(40)

    const second = await backend.mutation(api.pairedDecks.pollPairing, {
        pollToken,
    })
    expect(second).not.toHaveProperty('secret')
})

test('an approved code cannot be approved again', async () => {
    const backend = await seed()
    const owner = backend.withIdentity({ subject: 'owner-1' })
    const other = backend.withIdentity({ subject: 'owner-2' })
    const { code } = await startPairing(backend)

    await owner.mutation(api.pairedDecks.approvePairing, { code, name: 'A' })

    expect(
        await owner.mutation(api.pairedDecks.approvePairing, {
            code,
            name: 'B',
        })
    ).toEqual({ kind: 'used' })
    expect(
        await other.mutation(api.pairedDecks.approvePairing, {
            code,
            name: 'C',
        })
    ).toEqual({ kind: 'used' })
    expect(await other.query(api.pairedDecks.list, {})).toEqual([])
})

test('an expired code is refused, and its poll reports expired', async () => {
    vi.useFakeTimers()
    try {
        const backend = await seed()
        const owner = backend.withIdentity({ subject: 'owner-1' })
        const { code, pollToken } = await startPairing(backend)

        vi.advanceTimersByTime(10 * 60 * 1000 + 1)

        expect(
            await owner.mutation(api.pairedDecks.approvePairing, {
                code,
                name: 'Late deck',
            })
        ).toEqual({ kind: 'expired' })
        expect(
            await backend.mutation(api.pairedDecks.pollPairing, { pollToken })
        ).toEqual({ kind: 'expired' })
        expect(await owner.query(api.pairedDecks.list, {})).toEqual([])
    } finally {
        vi.useRealTimers()
    }
})

test('a hand-typed code is accepted in lower case and with a separator', async () => {
    const backend = await seed()
    const owner = backend.withIdentity({ subject: 'owner-1' })
    const { code } = await startPairing(backend)
    const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4).toLowerCase()}`

    expect(
        await owner.mutation(api.pairedDecks.approvePairing, {
            code: typed,
            name: 'Deck',
        })
    ).toEqual({ kind: 'ok' })
})

test('an approved deck is listed only once the plugin has collected its secret', async () => {
    const backend = await seed()
    const owner = backend.withIdentity({ subject: 'owner-1' })
    const { code, pollToken } = await startPairing(backend)
    await owner.mutation(api.pairedDecks.approvePairing, {
        code,
        name: 'Studio deck',
    })

    expect(await owner.query(api.pairedDecks.list, {})).toEqual([])

    await backend.mutation(api.pairedDecks.pollPairing, { pollToken })
    expect(
        (await owner.query(api.pairedDecks.list, {})).map((d) => d.name)
    ).toEqual(['Studio deck'])
})

test('too many live pairing requests are refused until some expire', async () => {
    vi.useFakeTimers()
    try {
        const backend = await seed()
        for (let i = 0; i < MAX_LIVE_PAIRINGS; i++) await startPairing(backend)

        expect(
            await backend.mutation(api.pairedDecks.startPairing, {})
        ).toEqual({ kind: 'rate_limited' })

        vi.advanceTimersByTime(PAIRING_TTL_MS + 1)
        expect(
            (await backend.mutation(api.pairedDecks.startPairing, {})).kind
        ).toBe('started')
    } finally {
        vi.useRealTimers()
    }
})

test('an unknown code is refused', async () => {
    const backend = await seed()
    const owner = backend.withIdentity({ subject: 'owner-1' })

    expect(
        await owner.mutation(api.pairedDecks.approvePairing, {
            code: 'ZZZZZZZZ',
            name: 'Deck',
        })
    ).toEqual({ kind: 'unknown' })
})

test('approving requires a signed-in owner', async () => {
    const backend = await seed()
    const { code, pollToken } = await startPairing(backend)

    await expect(
        backend.mutation(api.pairedDecks.approvePairing, { code, name: 'Deck' })
    ).rejects.toThrow('Not signed in')
    await expect(
        backend
            .withIdentity({ subject: 'no-community' })
            .mutation(api.pairedDecks.approvePairing, { code, name: 'Deck' })
    ).rejects.toThrow()

    expect(
        await backend.mutation(api.pairedDecks.pollPairing, { pollToken })
    ).toEqual({ kind: 'pending' })
})

function resolve(backend: Awaited<ReturnType<typeof seed>>, secret: string) {
    return backend.run(async (ctx) => {
        const resolved = await resolvePairedDeck(ctx, secret)
        if (!resolved) return null
        return {
            name: resolved.deck.name,
            ownerId: resolved.community.ownerId,
        }
    })
}

test('a secret resolves to its live Paired deck and Community', async () => {
    const backend = await seed()
    const secret = await pairDeck(backend, 'owner-1', 'Studio deck')

    expect(await resolve(backend, secret)).toEqual({
        name: 'Studio deck',
        ownerId: 'owner-1',
    })
    expect(await resolve(backend, 'nxtd_not-a-real-secret')).toBeNull()
    expect(await resolve(backend, '')).toBeNull()
})

test('the owner lists only their Community’s decks, with last used', async () => {
    const backend = await seed()
    const secret = await pairDeck(backend, 'owner-1', 'Studio deck')
    await pairDeck(backend, 'owner-2', 'Other deck')
    const owner = backend.withIdentity({ subject: 'owner-1' })

    expect(
        (await owner.query(api.pairedDecks.list, {})).map((d) => [
            d.name,
            d.lastUsedAt,
        ])
    ).toEqual([['Studio deck', null]])

    await backend.run(async (ctx) => {
        const resolved = await resolvePairedDeck(ctx, secret)
        await markPairedDeckUsed(ctx, resolved!.deck, 1_700_000_000_000)
    })
    expect(
        (await owner.query(api.pairedDecks.list, {})).map((d) => d.lastUsedAt)
    ).toEqual([1_700_000_000_000])

    expect(await backend.query(api.pairedDecks.list, {})).toEqual([])
})

test('revoking a Paired deck is scoped to the owner’s Community', async () => {
    const backend = await seed()
    const mine = await pairDeck(backend, 'owner-1', 'Studio deck')
    const theirs = await pairDeck(backend, 'owner-2', 'Other deck')
    const owner = backend.withIdentity({ subject: 'owner-1' })
    const other = backend.withIdentity({ subject: 'owner-2' })
    const [theirDeck] = await other.query(api.pairedDecks.list, {})
    const [myDeck] = await owner.query(api.pairedDecks.list, {})

    expect(
        await owner.mutation(api.pairedDecks.revoke, { id: theirDeck!.id })
    ).toEqual({ kind: 'unknown' })
    expect(await resolve(backend, theirs)).not.toBeNull()
    expect(await other.query(api.pairedDecks.list, {})).toHaveLength(1)

    expect(
        await owner.mutation(api.pairedDecks.revoke, { id: myDeck!.id })
    ).toEqual({ kind: 'ok' })
    expect(await resolve(backend, mine)).toBeNull()
    expect(await owner.query(api.pairedDecks.list, {})).toEqual([])

    await expect(
        backend.mutation(api.pairedDecks.revoke, { id: myDeck!.id })
    ).rejects.toThrow('Not signed in')
})

test('cleanup forgets old requests and decks that were never collected', async () => {
    vi.useFakeTimers()
    try {
        const backend = await seed()
        const owner = backend.withIdentity({ subject: 'owner-1' })
        const kept = await pairDeck(backend, 'owner-1', 'Collected deck')
        const { code } = await startPairing(backend)
        await owner.mutation(api.pairedDecks.approvePairing, {
            code,
            name: 'Never collected',
        })
        const stale = await startPairing(backend)

        vi.advanceTimersByTime(2 * 60 * 60 * 1000)
        const fresh = await startPairing(backend)
        await backend.mutation(internal.pairedDecks.prune, {})

        expect(
            (await owner.query(api.pairedDecks.list, {})).map((d) => d.name)
        ).toEqual(['Collected deck'])
        expect(await resolve(backend, kept)).not.toBeNull()
        expect(
            await owner.mutation(api.pairedDecks.approvePairing, {
                code: stale.code,
                name: 'Deck',
            })
        ).toEqual({ kind: 'unknown' })
        expect(
            await backend.mutation(api.pairedDecks.pollPairing, {
                pollToken: fresh.pollToken,
            })
        ).toEqual({ kind: 'pending' })
    } finally {
        vi.useRealTimers()
    }
})
