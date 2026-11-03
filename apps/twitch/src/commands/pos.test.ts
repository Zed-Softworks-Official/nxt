import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

test('!pos while paused tells a waiting chatter their position', async () => {
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

    await handle(chatMessage('!pos'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada You are #2 in the queue (q-2).',
    ])
})

test.each([
    [
        'notified' as const,
        '@ada You are not waiting: you have been pinged (q-1).',
    ],
    ['playing' as const, '@ada You are not waiting: you are playing (q-1).'],
])('!pos when %s says the chatter is not waiting', async (status, expected) => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        participants: [{ platformUserId: 'user-1', username: 'Ada', status }],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pos'))

    expect(sent.map((entry) => entry.text)).toEqual([expected])
})

test('!pos when absent says the chatter is not waiting', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pos'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada You are not waiting in the queue.',
    ])
})
