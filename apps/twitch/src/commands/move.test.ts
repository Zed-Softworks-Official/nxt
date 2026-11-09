import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readActivityLog,
    seedCommunity,
    twitchBot,
} from '../test/chatHarness'

const MODERATOR = { badges: { moderator: '1' } }
const USAGE =
    '@ada Use !moveq <reference> <position>, such as !moveq q-42 3, with a position of 1 or more.'

// q-1 bea, q-2 cy (Discord), q-3 dot waiting; q-4 eve Playing.
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
            {
                platformUserId: 'u-4',
                username: 'eve',
                status: 'playing',
                platform: 'twitch',
            },
        ],
    })
    return backend
}

// What `!viewq` shows: the Queue in order.
async function queueLine(backend: ReturnType<typeof createTestBackend>) {
    const { handle, sent } = twitchBot(backend)
    await handle(chatMessage('!viewq'))
    return sent.at(-1)?.text
}

test('!moveq gives a waiting Discord Participant a new Position, silently', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!moveq q-2 1', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Moved q-2 cy (Discord) to Position 1.',
    ])
    expect(await queueLine(backend)).toMatch(/q-2 cy.*q-1 bea.*q-3 dot/)
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('!moveq past the end of the queue moves them to the back', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!moveq q-1 99', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Moved q-1 bea (Twitch) to Position 3.',
    ])
    expect(await queueLine(backend)).toMatch(/q-2 cy.*q-3 dot.*q-1 bea/)
})

test('!moveq on a Playing or unknown reference is refused', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!moveq q-4 1', MODERATOR))
    await handle(chatMessage('!moveq q-99 1', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada q-4 is playing. Only a waiting Participant can be moved.',
        '@ada Nobody in the queue has the reference q-99.',
    ])
    expect(await queueLine(backend)).toMatch(/q-1 bea.*q-2 cy.*q-3 dot/)
})

test.each([
    '',
    'q-2',
    'q-2 0',
    'q-2 -1',
    'q-2 2.5',
    'q-2 first',
    'q-2 1 2',
    'bea 1',
])('!moveq %j gets a usage reply and moves nobody', async (arg) => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage(`!moveq ${arg}`, MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([USAGE])
    expect(await queueLine(backend)).toMatch(/q-1 bea.*q-2 cy.*q-3 dot/)
})

test('!moveq from a viewer is refused and moves nobody', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!moveq q-3 1'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !moveq.',
    ])
    expect(await queueLine(backend)).toMatch(/q-1 bea.*q-2 cy.*q-3 dot/)
})
