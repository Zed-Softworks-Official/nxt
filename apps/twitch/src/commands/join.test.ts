import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readQueue,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

test('!nxt join on an open queue adds the chatter and replies with their reference', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)
    const message = chatMessage('!nxt join')

    await handle(message)

    expect(sent).toEqual([
        {
            kind: 'reply',
            channelId: 'broadcaster-1',
            parentMessageId: message.messageId,
            text: '@Ada You joined the queue as q-1.',
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                reference: 1,
                username: 'Ada',
                platform: 'twitch',
                platformUserId: 'user-1',
                status: 'waiting',
            },
        ],
    })
})

test('!nxt join on a paused queue says it is paused and adds nobody', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'paused',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt join'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada The queue is paused, so you cannot join right now.',
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [],
    })
})

test('!nxt join while already in the queue keeps the one entry and says so', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        participants: [
            { platformUserId: 'user-1', username: 'Ada', status: 'waiting' },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt join'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada You are already in the queue as q-1.',
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                reference: 1,
                username: 'Ada',
                platform: 'twitch',
                platformUserId: 'user-1',
                status: 'waiting',
            },
        ],
    })
})

test('a renamed chatter keeps their entry because identity is the Twitch user ID', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        participants: [
            { platformUserId: 'user-1', username: 'Ada', status: 'waiting' },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(
        chatMessage('!nxt join', {
            chatterLogin: 'lovelace',
            chatterName: 'Lovelace',
        })
    )

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Lovelace You are already in the queue as q-1.',
    ])
    expect((await readQueue(backend, 'owner-1'))?.participants).toHaveLength(1)
})

test('a Twitch chatter with the same ID as a Discord participant gets a separate entry', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        participants: [
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'waiting',
                platform: 'discord',
            },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt join'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada You joined the queue as q-2.',
    ])
})
