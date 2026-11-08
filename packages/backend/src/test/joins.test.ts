import { api, internal } from '@nxt/backend/api'
import { afterEach, expect, test } from 'vitest'

import {
    createTestBackend,
    installFakeTwitch,
    readQueue,
    seedCommunity,
    type TestBackend,
} from '../testing'

const discord = { platform: 'discord', platformId: 'guild-1' } as const
const twitch = { platform: 'twitch', platformId: 'broadcaster-1' } as const

let uninstall: (() => void) | null = null
afterEach(() => {
    uninstall?.()
    uninstall = null
})

function asOwner(backend: TestBackend, ownerId = 'owner-1') {
    return backend.withIdentity({ subject: ownerId })
}

test('Joins are on for every linked platform until the owner turns them off', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [discord, twitch],
    })

    expect(
        await asOwner(backend).query(api.platformLinks.joinSettings, {})
    ).toEqual([
        { ...discord, joins: true },
        { ...twitch, joins: true },
    ])
})

test('the owner turning Joins off refuses joins from that platform only', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [discord, twitch],
    })

    expect(
        await asOwner(backend).mutation(api.platformLinks.setJoins, {
            ...discord,
            on: false,
        })
    ).toEqual({ kind: 'ok' })

    expect(
        await backend.mutation(internal.platformQueue.join, {
            link: discord,
            platformUserId: 'd-ada',
            username: 'ada',
        })
    ).toEqual({ kind: 'joins_off' })
    expect(
        await backend.mutation(internal.platformQueue.join, {
            link: twitch,
            platformUserId: 't-bob',
            username: 'bob',
        })
    ).toEqual({ kind: 'ok', reference: 1 })
})

test('turning Joins back on lets that platform join again', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [{ ...discord, joinsOff: true }],
    })

    await asOwner(backend).mutation(api.platformLinks.setJoins, {
        ...discord,
        on: true,
    })

    expect(
        await backend.mutation(internal.platformQueue.join, {
            link: discord,
            platformUserId: 'd-ada',
            username: 'ada',
        })
    ).toEqual({ kind: 'ok', reference: 1 })
})

test('a waiting Participant keeps their place, may ask their Position and may leave with Joins off', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [{ ...discord, joinsOff: true }],
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'waiting' },
        ],
    })
    const who = { link: discord, platformUserId: 'd-ada' }

    expect(
        await backend.mutation(internal.platformQueue.join, {
            ...who,
            username: 'ada',
        })
    ).toEqual({ kind: 'already', reference: 1 })
    expect(await backend.query(internal.platformQueue.position, who)).toEqual(
        expect.objectContaining({ kind: 'waiting', position: 1 })
    )
    expect(await backend.mutation(internal.platformQueue.leave, who)).toEqual({
        kind: 'ok',
        reference: 1,
    })
})

test('a paused Queue says paused rather than Joins off', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'paused',
        links: [{ ...discord, joinsOff: true }],
    })

    expect(
        await backend.mutation(internal.platformQueue.join, {
            link: discord,
            platformUserId: 'd-ada',
            username: 'ada',
        })
    ).toEqual({ kind: 'paused' })
})

test('only the owning Community can change a Platform Link Joins', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [discord],
    })
    await seedCommunity(backend, { ownerId: 'owner-2', state: 'open' })

    expect(
        await asOwner(backend, 'owner-2').mutation(api.platformLinks.setJoins, {
            ...discord,
            on: false,
        })
    ).toEqual({ kind: 'unlinked' })
    await expect(
        backend.mutation(api.platformLinks.setJoins, { ...discord, on: false })
    ).rejects.toThrow('Not signed in')

    expect(
        await backend.mutation(internal.platformQueue.join, {
            link: discord,
            platformUserId: 'd-ada',
            username: 'ada',
        })
    ).toEqual({ kind: 'ok', reference: 1 })
})

test('unlinking and relinking Twitch brings Joins back on', async () => {
    const backend = createTestBackend()
    const fake = installFakeTwitch({
        'code-1': {
            user: {
                id: 'broadcaster-1',
                login: 'streamer',
                displayName: 'Streamer',
            },
        },
    })
    uninstall = fake.uninstall
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [{ ...twitch, joinsOff: true }],
    })

    await asOwner(backend).action(api.twitchLink.unlink, {})
    const state = await asOwner(backend).mutation(
        api.linkStates.mintLinkState,
        { platform: 'twitch' }
    )
    await backend.fetch(
        `/twitch?${new URLSearchParams({ code: 'code-1', state })}`,
        { redirect: 'manual' }
    )

    expect(
        await asOwner(backend).query(api.platformLinks.joinSettings, {})
    ).toEqual([{ ...twitch, joins: true }])
    expect((await readQueue(backend, 'owner-1'))?.participants).toEqual([])
})
