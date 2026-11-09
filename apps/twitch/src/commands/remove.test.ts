import { internal } from '@nxt/backend/api'
import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readActivityLog,
    readQueue,
    seedCommunity,
    twitchBot,
} from '../test/chatHarness'

const MODERATOR = { badges: { moderator: '1' } }

// q-1 waiting on Discord, q-2 Pinged on Twitch, q-3 Playing on Discord.
async function sharedQueue() {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'paused',
        links: [
            { platform: 'twitch', platformId: 'broadcaster-1' },
            { platform: 'discord', platformId: 'guild-1' },
        ],
        participants: [
            {
                platformUserId: 'u-1',
                username: 'bea',
                status: 'waiting',
                platform: 'discord',
            },
            {
                platformUserId: 'u-2',
                username: 'cy',
                status: 'notified',
                platform: 'twitch',
            },
            {
                platformUserId: 'u-3',
                username: 'dot',
                status: 'playing',
                platform: 'discord',
            },
        ],
    })
    return backend
}

async function references(backend: ReturnType<typeof createTestBackend>) {
    return (await readQueue(backend, 'owner-1'))?.participants.map(
        (p) => p.reference
    )
}

test('!removeq silently Removes a waiting, Pinged, or Playing Participant from any platform', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!removeq q-1', MODERATOR))
    await handle(chatMessage('!removeq q-2', MODERATOR))
    await handle(chatMessage('!removeq q-3', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Removed q-1 bea (Discord).',
        '@ada Removed q-2 cy (Twitch).',
        '@ada Removed q-3 dot (Discord).',
    ])
    expect(await references(backend)).toEqual([])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
    expect(
        await backend.query(internal.announcements.pending, {
            platform: 'twitch',
        })
    ).toEqual([])
})

test('!removeq on an unknown or already Removed reference says nobody has it', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!removeq q-1', MODERATOR))
    await handle(chatMessage('!removeq q-1', MODERATOR))
    await handle(chatMessage('!removeq q-99', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Removed q-1 bea (Discord).',
        '@ada Nobody in the queue has the reference q-1.',
        '@ada Nobody in the queue has the reference q-99.',
    ])
    expect(await references(backend)).toEqual([2, 3])
})

test.each([
    ['', '@ada Use !removeq <reference>, such as !removeq q-42.'],
    ['bea', '@ada "bea" is not a Participant reference. Use one like q-42.'],
])('!removeq %j gets a usage reply and Removes nobody', async (arg, reply) => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage(`!removeq ${arg}`, MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([reply])
    expect(await references(backend)).toEqual([1, 2, 3])
})

test('!removeq from a viewer is refused and Removes nobody', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!removeq q-1'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !removeq.',
    ])
    expect(await references(backend)).toEqual([1, 2, 3])
})
