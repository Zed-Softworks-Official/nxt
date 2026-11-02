import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readQueue,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

const MODERATOR = { badges: { moderator: '1' } }

test('!nxt pause from a moderator pauses an open queue', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt pause', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada The queue is paused.',
    ])
    expect((await readQueue(backend, 'owner-1'))?.state).toBe('paused')
})

test('!nxt pause on a paused queue says it is already paused', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'paused',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt pause', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada The queue is already paused.',
    ])
})

test('!nxt pause from a viewer is refused and leaves the queue open', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt pause'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !nxt pause.',
    ])
    expect((await readQueue(backend, 'owner-1'))?.state).toBe('open')
})
