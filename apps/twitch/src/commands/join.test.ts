import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readQueue,
    seedCommunity,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

test('!joinq on an open queue adds the chatter and replies with their reference', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)
    const message = chatMessage('!joinq')

    await handle(message)

    expect(sent).toEqual([
        {
            kind: 'reply',
            channelId: 'broadcaster-1',
            parentMessageId: message.messageId,
            text: '@ada You joined the queue as q-1.',
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

test('!joinq on a paused queue says it is paused and adds nobody', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'paused',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada The queue is paused, so you cannot join right now.',
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [],
    })
})

test('!joinq while already in the queue keeps the one entry and says so', async () => {
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

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada You are already in the queue as q-1.',
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
        chatMessage('!joinq', {
            chatterLogin: 'lovelace',
            chatterName: 'Lovelace',
        })
    )

    expect(sent.map((entry) => entry.text)).toEqual([
        '@lovelace You are already in the queue as q-1.',
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

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada You joined the queue as q-2.',
    ])
})

test('!joinq with Twitch Joins off says so, for Twitch Admins too, and adds nobody', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [
            {
                platform: 'twitch',
                platformId: 'broadcaster-1',
                joinsOff: true,
            },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))
    await handle(
        chatMessage('!joinq', {
            chatterId: 'mod-1',
            chatterLogin: 'mod',
            badges: { moderator: '1' },
        })
    )

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Joining from Twitch is off right now.',
        '@mod Joining from Twitch is off right now.',
    ])
    expect((await readQueue(backend, 'owner-1'))?.participants).toEqual([])
})
