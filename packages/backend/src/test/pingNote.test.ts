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

async function seedTwoWaiting() {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [{ ...discord, commandChannelId: 'commands' }, twitch],
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'waiting' },
            {
                platformUserId: 't-bob',
                username: 'bob',
                status: 'waiting',
                platform: 'twitch',
            },
        ],
    })
    return backend
}

test('a typed Ping note reaches each Pinged Participant on every platform', async () => {
    const backend = await seedTwoWaiting()

    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 2,
        note: 'VC 2, lobby code is ABCD',
    })

    const [ada] = await backend.query(internal.announcements.pending, {
        platform: 'discord',
    })
    const [bob] = await backend.query(internal.announcements.pending, {
        platform: 'twitch',
    })
    expect(ada).toMatchObject({ note: 'VC 2, lobby code is ABCD' })
    expect(bob).toMatchObject({ note: 'VC 2, lobby code is ABCD' })
})

test('the owner saves a Ping note, and it is used when no note is typed', async () => {
    const backend = await seedTwoWaiting()
    const owner = backend.withIdentity({ subject: 'owner-1' })

    await owner.mutation(api.communities.setSavedPingNote, {
        note: 'Join VC 2',
    })
    await owner.mutation(api.queue.ping, { count: 1 })
    await backend.mutation(internal.platformQueue.ping, {
        link: twitch,
        count: 1,
    })

    expect(await owner.query(api.communities.savedPingNote, {})).toBe(
        'Join VC 2'
    )
    expect(await pendingNotes(backend)).toEqual(['Join VC 2', 'Join VC 2'])
})

test('a typed Ping note replaces the Saved ping note for that Ping only', async () => {
    const backend = await seedTwoWaiting()
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.communities.setSavedPingNote, {
        note: 'Join VC 2',
    })

    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
        note: 'VC 3 tonight',
    })
    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
    })

    expect(await pendingNotes(backend)).toEqual(['VC 3 tonight', 'Join VC 2'])
})

test('editing the Saved ping note does not change a Ping already made', async () => {
    const backend = await seedTwoWaiting()
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.communities.setSavedPingNote, { note: 'Old code' })
    await owner.mutation(api.queue.ping, { count: 1 })

    await owner.mutation(api.communities.setSavedPingNote, { note: 'New code' })

    expect(await pendingNotes(backend)).toEqual(['Old code'])
})

test('clearing the Saved ping note means Pings carry no note', async () => {
    const backend = await seedTwoWaiting()
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.communities.setSavedPingNote, { note: 'Old code' })

    await owner.mutation(api.communities.setSavedPingNote, { note: '   ' })
    await owner.mutation(api.queue.ping, { count: 1 })

    expect(await owner.query(api.communities.savedPingNote, {})).toBeNull()
    expect(await pendingNotes(backend)).toEqual([undefined])
})

test('only a signed-in owner can read or change a Saved ping note', async () => {
    const backend = await seedTwoWaiting()

    expect(await backend.query(api.communities.savedPingNote, {})).toBeNull()
    await expect(
        backend.mutation(api.communities.setSavedPingNote, { note: 'Hijack' })
    ).rejects.toThrow('Not signed in')
})

test('a Saved ping note belongs to one Community', async () => {
    const backend = await seedTwoWaiting()
    await seedCommunity(backend, { ownerId: 'owner-2', state: 'open' })

    await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.communities.setSavedPingNote, { note: 'Join VC 2' })

    expect(
        await backend
            .withIdentity({ subject: 'owner-2' })
            .query(api.communities.savedPingNote, {})
    ).toBeNull()
})

async function pendingNotes(backend: TestBackend) {
    const rows = [
        ...(await backend.query(internal.announcements.pending, {
            platform: 'discord',
        })),
        ...(await backend.query(internal.announcements.pending, {
            platform: 'twitch',
        })),
    ]
    return rows.map((row) => (row.action === 'post' ? row.note : 'dropped'))
}

test('a typed Ping note is tidied: trimmed, and line breaks become spaces', async () => {
    const backend = await seedTwoWaiting()

    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
        note: '  VC 2\r\n  lobby ABCD\n',
    })

    expect(await pendingNotes(backend)).toEqual(['VC 2 lobby ABCD'])
})

test('a blank typed Ping note counts as none, so the Saved ping note is used', async () => {
    const backend = await seedTwoWaiting()
    await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.communities.setSavedPingNote, { note: 'Join VC 2' })

    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
        note: ' \n ',
    })

    expect(await pendingNotes(backend)).toEqual(['Join VC 2'])
})

test('a 200-character note is accepted', async () => {
    const backend = await seedTwoWaiting()

    const result = await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
        note: 'x'.repeat(200),
    })

    expect(result.kind).toBe('ok')
})

test('an over-limit typed note rejects the whole Ping, so nobody moves', async () => {
    const backend = await seedTwoWaiting()

    const result = await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 2,
        note: 'x'.repeat(201),
    })

    expect(result).toEqual({ kind: 'note_too_long', max: 200 })
    const queue = await readQueue(backend, 'owner-1')
    expect(queue?.participants.map((p) => p.status)).toEqual([
        'waiting',
        'waiting',
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
    expect(await pendingNotes(backend)).toEqual([])
})

test('an over-limit Saved ping note is rejected and the old one stays', async () => {
    const backend = await seedTwoWaiting()
    const owner = backend.withIdentity({ subject: 'owner-1' })
    await owner.mutation(api.communities.setSavedPingNote, { note: 'Keep me' })

    const result = await owner.mutation(api.communities.setSavedPingNote, {
        note: 'x'.repeat(201),
    })

    expect(result).toEqual({ kind: 'note_too_long', max: 200 })
    expect(await owner.query(api.communities.savedPingNote, {})).toBe('Keep me')
})

test('a note never appears in the Activity log', async () => {
    const backend = await seedTwoWaiting()

    await backend.mutation(internal.platformQueue.ping, {
        link: discord,
        count: 1,
        note: 'Secret code',
    })

    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'pinged',
            username: 'ada',
            platform: 'discord',
            platformUserId: 'd-ada',
        },
    ])
})
