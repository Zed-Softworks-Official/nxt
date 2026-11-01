import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

test('!nxt pos while paused tells a waiting chatter their position', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'paused',
        participants: [
            {
                platformUserId: 'user-9',
                username: 'zed',
                status: 'waiting',
                platform: 'discord',
            },
            { platformUserId: 'user-1', username: 'Ada', status: 'waiting' },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt pos'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada You are #2 in the queue (q-2).',
    ])
})

test.each([
    [
        'notified' as const,
        '@Ada You are not waiting: you have been pinged (q-1).',
    ],
    ['playing' as const, '@Ada You are not waiting: you are playing (q-1).'],
])('!nxt pos when %s says the chatter is not waiting', async (status, expected) => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        participants: [{ platformUserId: 'user-1', username: 'Ada', status }],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt pos'))

    expect(sent.map((entry) => entry.text)).toEqual([expected])
})

test('!nxt pos when absent says the chatter is not waiting', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt pos'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada You are not waiting in the queue.',
    ])
})
