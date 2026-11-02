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

// q-1 waiting on Discord, q-2 Pinged on Twitch, q-3 Playing on Discord.
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
                platform: 'discord',
            },
            {
                platformUserId: 'u-2',
                username: 'cy',
                status: 'notified',
                platform: 'twitch',
            },
            {
                platformUserId: 'u-3',
                username: 'dot',
                status: 'playing',
                platform: 'discord',
            },
        ],
    })
    return backend
}

async function participants(backend: ReturnType<typeof createTestBackend>) {
    return (await readQueue(backend, 'owner-1'))?.participants.map((p) => [
        p.reference,
        p.status,
    ])
}

test('!nxt return puts a Pinged Participant back in their spot with the same reference and logs it', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt return q-2', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada q-2 cy (Twitch) is back in the queue.',
    ])
    expect(await participants(backend)).toEqual([
        [1, 'waiting'],
        [2, 'waiting'],
        [3, 'playing'],
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'returned_to_queue',
            username: 'cy',
            platform: 'twitch',
            platformUserId: 'u-2',
        },
    ])
})

test('!nxt return on a Playing Participant is refused', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt return q-3', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada q-3 is playing. Only a Pinged Participant can return to the queue.',
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test("a Twitch Admin finishes a Playing Discord Participant's turn and it is logged", async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt done q-3', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada q-3 dot (Discord) is done.',
    ])
    expect(await participants(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'finished',
            username: 'dot',
            platform: 'discord',
            platformUserId: 'u-3',
        },
    ])
})

test('!nxt done on a Pinged Participant is refused', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt done q-2', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada q-2 is Pinged. Only a Playing Participant can finish.',
    ])
    expect(await participants(backend)).toHaveLength(3)
})

test('return and done from a viewer are refused and change nothing', async () => {
    const backend = await sharedQueue()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt return q-2'))
    await handle(chatMessage('!nxt done q-3'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !nxt return.',
        '@ada Only the broadcaster and moderators can run !nxt done.',
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})
