import { internal } from '@nxt/backend/api'
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

test('!pingq calls the Participant at the front of the queue and logs it', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pingq', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Pinged q-1 bea (Twitch).',
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

test('!pingq 2 calls the front two, including a Discord Participant', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pingq 2', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Pinged q-1 bea (Twitch), q-2 cy (Discord).',
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

test('!pingq on an empty queue says nobody is waiting', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pingq', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Nobody is waiting in the queue.',
    ])
})

test.each([
    '0',
    'three',
    '11',
    '2.5',
    '3x',
    'VC 2',
    '11 VC 2',
])('!pingq %s is refused with the allowed range and pings nobody', async (count) => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage(`!pingq ${count}`, MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Use !pingq, !pingq <count>, !pingq <count> <note>, or !pingq q-<n> <note>, with a count from 1 to 10.',
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'waiting'],
        [3, 'waiting'],
    ])
})

test('!pingq from a viewer is refused and pings nobody', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pingq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !pingq.',
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('!pingq with a count and a note carries the note', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pingq 1 VC 2 lobby ABCD', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Pinged q-1 bea (Twitch).',
    ])
    const [announcement] = await backend.query(internal.announcements.pending, {
        platform: 'twitch',
    })
    expect(announcement).toMatchObject({ note: 'VC 2 lobby ABCD' })
})

test('!pingq with an over-limit note says so and calls nobody', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage(`!pingq 1 ${'x'.repeat(201)}`, MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada That note is too long. Keep it to 200 characters.',
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'waiting'],
        [3, 'waiting'],
    ])
})

test('!pingq q-3 calls that waiting Participant out of order with the note', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pingq q-3 VC 2', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Pinged q-3 dot (Twitch).',
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'waiting'],
        [3, 'notified'],
    ])
    expect(
        (await readActivityLog(backend, 'owner-1')).map((e) => e.username)
    ).toEqual(['dot'])
    const [announcement] = await backend.query(internal.announcements.pending, {
        platform: 'twitch',
    })
    expect(announcement).toMatchObject({ note: 'VC 2' })
})

test('!pingq on an unknown or non-waiting reference is refused and calls nobody', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pingq q-2', MODERATOR))
    await handle(chatMessage('!pingq q-2', MODERATOR))
    await handle(chatMessage('!pingq q-99', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Pinged q-2 cy (Discord).',
        '@ada q-2 is Pinged. Only a waiting Participant can be Pinged.',
        '@ada Nobody in the queue has the reference q-99.',
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
        [3, 'waiting'],
    ])
})

test.each([
    'q-0',
    'q-x',
])('!pingq %s is refused as not a reference and pings nobody', async (arg) => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage(`!pingq ${arg}`, MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        `@ada "${arg}" is not a Participant reference. Use one like q-42.`,
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'waiting'],
        [3, 'waiting'],
    ])
})

test('!pingq q-1 from a viewer is refused and pings nobody', async () => {
    const backend = await channelWithThreeWaiting()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!pingq q-1'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !pingq.',
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})
