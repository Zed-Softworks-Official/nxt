import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readQueue,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

const MODERATOR = { badges: { moderator: '1' } }

test('!startq from a moderator opens a paused queue', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'paused',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!startq', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual(['@ada The queue is open.'])
    expect((await readQueue(backend, 'owner-1'))?.state).toBe('open')
})

test('!startq from a viewer without moderator rights is refused and changes nothing', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'paused',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!startq', { badges: { subscriber: '12' } }))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !startq.',
    ])
    expect((await readQueue(backend, 'owner-1'))?.state).toBe('paused')
})

test('the broadcaster counts as a Twitch Admin in their own channel, badge or not', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'paused',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(
        chatMessage('!startq', {
            chatterId: 'broadcaster-1',
            chatterLogin: 'grace',
            chatterName: 'Grace',
        })
    )

    expect(sent.map((entry) => entry.text)).toEqual([
        '@grace The queue is open.',
    ])
    expect((await readQueue(backend, 'owner-1'))?.state).toBe('open')
})

test('a broadcaster badge counts as a Twitch Admin', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'paused',
    })
    const { handle } = twitchBot(backend)

    await handle(chatMessage('!startq', { badges: { broadcaster: '1' } }))

    expect((await readQueue(backend, 'owner-1'))?.state).toBe('open')
})

test('!startq on an open queue says it is already open', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!startq', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada The queue is already open.',
    ])
})
