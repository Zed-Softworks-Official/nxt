import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readQueue,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

test('!nxt leave while paused removes the waiting chatter', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'paused',
        participants: [
            { platformUserId: 'user-1', username: 'Ada', status: 'waiting' },
            { platformUserId: 'user-2', username: 'Bob', status: 'waiting' },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt leave'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada You left the queue.',
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [
            {
                reference: 2,
                username: 'Bob',
                platform: 'twitch',
                platformUserId: 'user-2',
                status: 'waiting',
            },
        ],
    })
})

test('!nxt leave when not in the queue says so', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt leave'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada You are not in the queue.',
    ])
})
