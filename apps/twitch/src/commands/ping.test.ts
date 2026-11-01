import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readActivityLog,
    readQueue,
    seedCommunity,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

const MODERATOR = { badges: { moderator: '1' } }

async function channelWithThreeWaiting() {
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
                username: 'bea',
                status: 'waiting',
                platform: 'twitch',
            },
            {
                platformUserId: 'u-2',
                username: 'cy',
                status: 'waiting',
                platform: 'discord',
            },
            {
                platformUserId: 'u-3',
                username: 'dot',
                status: 'waiting',
                platform: 'twitch',
            },
        ],
    })
    return backend
}

async function statuses(backend: ReturnType<typeof createTestBackend>) {
    return (await readQueue(backend, 'owner-1'))?.participants.map((p) => [
        p.reference,
        p.status,
    ])
}

test('!nxt ping calls the Participant at the front of the queue and logs it', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt ping', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada Pinged q-1 bea (Twitch).',
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'notified'],
        [2, 'waiting'],
        [3, 'waiting'],
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'pinged',
            username: 'bea',
            platform: 'twitch',
            platformUserId: 'u-1',
        },
    ])
})

test('!nxt ping 2 calls the front two, including a Discord Participant', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt ping 2', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada Pinged q-1 bea (Twitch), q-2 cy (Discord).',
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'notified'],
        [2, 'notified'],
        [3, 'waiting'],
    ])
    expect(
        (await readActivityLog(backend, 'owner-1')).map((e) => e.username)
    ).toEqual(['bea', 'cy'])
})

test('!nxt ping on an empty queue says nobody is waiting', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt ping', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada Nobody is waiting in the queue.',
    ])
})

test.each([
    '0',
    'three',
    '11',
    '2.5',
])('!nxt ping %s is refused with the allowed range and pings nobody', async (count) => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage(`!nxt ping ${count}`, MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada Use !nxt ping, or !nxt ping <count> with a count from 1 to 10.',
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'waiting'],
        [3, 'waiting'],
    ])
})

test('!nxt ping from a viewer is refused and pings nobody', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt ping'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada Only the broadcaster and moderators can run !nxt ping.',
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})
