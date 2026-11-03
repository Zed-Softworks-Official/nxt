import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readQueue,
    seedCommunity,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

const MODERATOR = { badges: { moderator: '1' } }

test('!clearq removes waiting Participants from every platform and leaves Pinged and Playing in place', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [
            { platform: 'twitch', platformId: 'broadcaster-1' },
            { platform: 'discord', platformId: 'guild-1' },
        ],
        participants: [
            {
                platformUserId: 'u-1',
                username: 'tw-wait',
                status: 'waiting',
                platform: 'twitch',
            },
            {
                platformUserId: 'u-2',
                username: 'dc-wait',
                status: 'waiting',
                platform: 'discord',
            },
            {
                platformUserId: 'u-3',
                username: 'tw-ping',
                status: 'notified',
                platform: 'twitch',
            },
            {
                platformUserId: 'u-4',
                username: 'dc-play',
                status: 'playing',
                platform: 'discord',
            },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!clearq', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Cleared 2 from the queue.',
    ])
    expect(
        (await readQueue(backend, 'owner-1'))?.participants.map((p) => [
            p.username,
            p.status,
        ])
    ).toEqual([
        ['tw-ping', 'notified'],
        ['dc-play', 'playing'],
    ])
})

test('!clearq with nobody waiting says the queue is already empty', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        participants: [
            { platformUserId: 'u-3', username: 'tw-ping', status: 'notified' },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!clearq', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Nobody is waiting, so there is nothing to clear.',
    ])
})

test('!clearq from a viewer is refused and removes nobody', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        participants: [
            { platformUserId: 'u-1', username: 'tw-wait', status: 'waiting' },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!clearq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !clearq.',
    ])
    expect((await readQueue(backend, 'owner-1'))?.participants).toHaveLength(1)
})
