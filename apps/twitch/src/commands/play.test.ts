import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    readActivityLog,
    readQueue,
    seedCommunity,
    twitchBot,
} from '../test/chatHarness'

const MODERATOR = { badges: { moderator: '1' } }

// q-1 waiting on Twitch, q-2 Pinged on Discord, q-3 Playing on Twitch.
async function sharedQueue() {
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
                status: 'notified',
                platform: 'discord',
            },
            {
                platformUserId: 'u-3',
                username: 'dot',
                status: 'playing',
                platform: 'twitch',
            },
        ],
    })
    return backend
}

async function statusOf(
    backend: ReturnType<typeof createTestBackend>,
    reference: number
) {
    return (await readQueue(backend, 'owner-1'))?.participants.find(
        (p) => p.reference === reference
    )?.status
}

test('a Twitch Admin moves a Pinged Discord Participant to Playing by reference', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!playq q-2', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada q-2 cy (Discord) is now playing.',
    ])
    expect(await statusOf(backend, 2)).toBe('playing')
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('!playq on someone already Playing is refused with their state', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!playq q-3', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada q-3 is playing. Only a Pinged Participant can start playing.',
    ])
    expect(await statusOf(backend, 3)).toBe('playing')
})

test('!playq on someone still waiting is refused with their state', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!playq q-1', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada q-1 is waiting in the queue. Only a Pinged Participant can start playing.',
    ])
    expect(await statusOf(backend, 1)).toBe('waiting')
})

test('!playq with an unknown reference is refused', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!playq q-42', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Nobody in the queue has the reference q-42.',
    ])
})

test('!playq with an ended reference is refused like an unknown one', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!doneq q-3', MODERATOR))
    await handle(chatMessage('!playq q-3', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada q-3 dot (Twitch) is done.',
        '@ada Nobody in the queue has the reference q-3.',
    ])
})

test.each([
    ['!playq', 'Use !playq <reference>, such as !playq q-42.'],
    ['!playq bea', '"bea" is not a Participant reference. Use one like q-42.'],
])('%s is refused with how to name a Participant', async (text, reply) => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage(text, MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([`@ada ${reply}`])
    expect(await statusOf(backend, 2)).toBe('notified')
})

test('!playq from a viewer is refused and changes nothing', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!playq q-2'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !playq.',
    ])
    expect(await statusOf(backend, 2)).toBe('notified')
})
