import { api } from '@nxt/backend/api'
import { expect, test, vi } from 'vitest'

import {
    createTestBackend,
    deck,
    pairDeck,
    readQueue,
    revokeOnlyDeck,
    seedCommunity,
    type TestBackend,
} from './test/deckHarness'

// ada and cy are Pinged, bob is Playing, dee and eve are waiting.
async function seed(state: 'open' | 'paused' = 'open') {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state,
        participants: [
            { platformUserId: 'd-ada', username: 'ada', status: 'notified' },
            {
                platformUserId: 't-bob',
                username: 'bob',
                status: 'playing',
                platform: 'twitch',
            },
            {
                platformUserId: 't-cy',
                username: 'cy',
                status: 'notified',
                platform: 'twitch',
            },
            { platformUserId: 'd-dee', username: 'dee', status: 'waiting' },
            { platformUserId: 'd-eve', username: 'eve', status: 'waiting' },
        ],
    })
    return backend
}

async function pairedDeck(backend: TestBackend) {
    return await deck(backend, { secret: await pairDeck(backend, 'owner-1') })
}

test('counter keys show how many are waiting and Pinged', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)

    d.controller.showKey('w', 'waitingCount', {})
    d.controller.showKey('p', 'pingedCount', {})

    expect(d.key('w')).toEqual({
        connection: 'live',
        icon: 'waiting',
        title: '2',
        platform: null,
        dimmed: false,
        warning: false,
    })
    expect(d.key('p')).toMatchObject({ icon: 'pinged', title: '2' })
})

test('a Ping key is dimmed when fewer than N are waiting', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)

    d.controller.showKey('one', 'ping', {})
    d.controller.showKey('two', 'ping', { count: 2 })
    d.controller.showKey('four', 'ping', { count: 4 })

    expect(d.key('one')).toMatchObject({
        icon: 'ping',
        title: 'Ping 1',
        dimmed: false,
    })
    expect(d.key('two')).toMatchObject({ title: 'Ping 2', dimmed: false })
    expect(d.key('four')).toMatchObject({ title: 'Ping 4', dimmed: true })
})

test('a Ping key reads N from 1 to 10, defaulting to 1', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)

    d.controller.showKey('k', 'ping', { count: 25 })
    expect(d.key('k').title).toBe('Ping 10')
    d.controller.showKey('k', 'ping', { count: 0 })
    expect(d.key('k').title).toBe('Ping 1')
    d.controller.showKey('k', 'ping', { count: 'lots' })
    expect(d.key('k').title).toBe('Ping 1')
    d.controller.showKey('k', 'ping', { count: 3.7 })
    expect(d.key('k').title).toBe('Ping 3')
})

test('the Open/Pause key shows the Queue state and toggles it', async () => {
    const backend = await seed('open')
    const d = await pairedDeck(backend)
    d.controller.showKey('k', 'openPause', {})

    expect(d.key('k')).toMatchObject({ icon: 'open', title: 'Open' })

    await d.press('k')
    expect((await readQueue(backend, 'owner-1'))?.state).toBe('paused')
    expect(d.key('k')).toMatchObject({ icon: 'paused', title: 'Paused' })

    await d.press('k')
    expect((await readQueue(backend, 'owner-1'))?.state).toBe('open')
    expect(d.key('k')).toMatchObject({ icon: 'open', title: 'Open' })

    expect(d.feedback).toEqual([
        { key: 'k', feedback: 'ok' },
        { key: 'k', feedback: 'ok' },
    ])
})

test('a Ping press calls up to N and reports how it went', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    d.controller.showKey('k', 'ping', { count: 4 })

    // Only two are waiting: a partial Ping still counts as a success.
    await d.press('k')
    expect(
        (await readQueue(backend, 'owner-1'))?.participants
            .filter((p) => p.status === 'notified')
            .map((p) => p.username)
    ).toEqual(['ada', 'cy', 'dee', 'eve'])
    expect(d.feedback).toEqual([{ key: 'k', feedback: 'ok' }])

    // Nobody is waiting now.
    await d.press('k')
    expect(d.feedback.at(-1)).toEqual({ key: 'k', feedback: 'alert' })
})

test('a Ping refused for an over-long Saved ping note, or a failed request, gives a warning', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    d.controller.showKey('k', 'ping', {})

    d.client.replyOnce({ kind: 'note_too_long', max: 200 })
    await d.press('k')
    d.client.replyOnce(new Error('server error'))
    await d.press('k')

    expect(d.feedback).toEqual([
        { key: 'k', feedback: 'alert' },
        { key: 'k', feedback: 'alert' },
    ])
    expect((await readQueue(backend, 'owner-1'))?.participants).toContainEqual(
        expect.objectContaining({ username: 'dee', status: 'waiting' })
    )
})

test('slot keys show the Participant in that slot, in join order, with their platform', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)

    d.controller.showKey('play1', 'play', { slot: 1 })
    d.controller.showKey('return2', 'return', { slot: 2 })
    d.controller.showKey('done1', 'done', {})

    expect(d.key('play1')).toEqual({
        connection: 'live',
        icon: 'play',
        title: 'ada',
        platform: 'discord',
        dimmed: false,
        warning: false,
    })
    expect(d.key('return2')).toMatchObject({
        icon: 'return',
        title: 'cy',
        platform: 'twitch',
    })
    expect(d.key('done1')).toMatchObject({
        icon: 'done',
        title: 'bob',
        platform: 'twitch',
    })
})

test('an empty slot key is blank and dimmed', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)

    d.controller.showKey('play3', 'play', { slot: 3 })
    d.controller.showKey('done2', 'done', { slot: 2 })

    for (const key of ['play3', 'done2']) {
        expect(d.key(key)).toMatchObject({
            title: '',
            platform: null,
            dimmed: true,
            warning: false,
        })
    }
})

test('a long name is cut off with an ellipsis and no reference is shown', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        participants: [
            {
                platformUserId: 'd-long',
                username: 'Bartholomew',
                status: 'notified',
            },
            {
                platformUserId: 'd-fit',
                username: 'Penelope',
                status: 'notified',
            },
        ],
    })
    const d = await pairedDeck(backend)

    d.controller.showKey('a', 'play', { slot: 1 })
    d.controller.showKey('b', 'play', { slot: 2 })

    expect(d.key('a').title).toBe('Barthol…')
    expect(d.key('b').title).toBe('Penelope')
})

test('Play, Return and Done act on the Participant the key shows', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    d.controller.showKey('play', 'play', { slot: 1 })
    d.controller.showKey('return', 'return', { slot: 2 })
    d.controller.showKey('done', 'done', { slot: 1 })

    await d.press('return') // cy goes back to waiting
    await d.press('done') // bob finishes and leaves the Queue
    await d.press('play') // ada starts playing

    const queue = await readQueue(backend, 'owner-1')
    expect(queue?.participants.map((p) => [p.username, p.status])).toEqual([
        ['ada', 'playing'],
        ['cy', 'waiting'],
        ['dee', 'waiting'],
        ['eve', 'waiting'],
    ])
    expect(d.feedback.map((f) => f.feedback)).toEqual(['ok', 'ok', 'ok'])
    expect(d.key('done')).toMatchObject({ title: 'ada' })
    expect(d.key('play')).toMatchObject({ title: '', dimmed: true })
})

test('a slot press sends the reference that was showing, and warns if someone else moved them', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    d.controller.showKey('play', 'play', { slot: 1 })

    // A Discord Admin plays ada; the deck hasn't seen it yet.
    await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.queue.play, { reference: 1 })

    await d.press('play')

    expect(d.feedback).toEqual([{ key: 'play', feedback: 'alert' }])
    // cy, now first in the Pinged list, was not touched.
    expect(
        (await readQueue(backend, 'owner-1'))?.participants.find(
            (p) => p.username === 'cy'
        )?.status
    ).toBe('notified')
})

test('pressing an empty slot does nothing', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    d.controller.showKey('play', 'play', { slot: 3 })
    const before = await readQueue(backend, 'owner-1')

    await d.press('play')

    expect(d.feedback).toEqual([])
    expect(await readQueue(backend, 'owner-1')).toEqual(before)
})

test('a slot key ignores presses for a second after its Participant changes', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    d.controller.showKey('play', 'play', { slot: 1 })

    await d.press('play') // ada plays; cy moves into slot 1
    expect(d.key('play').title).toBe('cy')

    await d.press('play') // a quick double-tap
    d.time.advance(999)
    await d.press('play')
    expect(d.feedback).toEqual([{ key: 'play', feedback: 'ok' }])
    const status = async (name: string) =>
        (await readQueue(backend, 'owner-1'))?.participants.find(
            (p) => p.username === name
        )?.status
    expect(await status('cy')).toBe('notified')

    d.time.advance(1)
    await d.press('play')
    expect(await status('cy')).toBe('playing')
    expect(d.feedback.at(-1)).toEqual({ key: 'play', feedback: 'ok' })
})

test('a Pinged slot key shows a warning mark once its Announcement has failed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
        vi.setSystemTime(1_700_000_000_000)
        const backend = createTestBackend()
        await seedCommunity(backend, {
            ownerId: 'owner-1',
            state: 'open',
            links: [{ platform: 'discord', platformId: 'guild-1' }],
            participants: [
                { platformUserId: 'd-ada', username: 'ada', status: 'waiting' },
            ],
        })
        const d = await pairedDeck(backend)
        d.controller.showKey('play', 'play', { slot: 1 })
        d.controller.showKey('ping', 'ping', {})

        await d.press('ping') // the bot never posts the Announcement
        expect(d.key('play')).toMatchObject({ title: 'ada', warning: false })

        d.time.advance(29_000)
        expect(d.key('play').warning).toBe(false)
        d.time.advance(1_001)
        expect(d.key('play').warning).toBe(true)
    } finally {
        vi.useRealTimers()
    }
})

const everyAction = [
    ['ping', 'ping'],
    ['openPause', 'open'],
    ['play', 'play'],
    ['return', 'return'],
    ['done', 'done'],
    ['waitingCount', 'waiting'],
    ['pingedCount', 'pinged'],
] as const

test('every key turns grey and shows offline when the connection drops, then recovers', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    for (const [action] of everyAction) d.controller.showKey(action, action, {})

    d.client.setConnected(false)

    for (const [action, icon] of everyAction) {
        expect(d.key(action)).toEqual({
            connection: 'offline',
            icon,
            title: 'offline',
            platform: null,
            dimmed: true,
            warning: false,
        })
    }

    // A press while offline is refused rather than queued for later.
    const before = await readQueue(backend, 'owner-1')
    await d.press('ping')
    await d.press('play')
    expect(await readQueue(backend, 'owner-1')).toEqual(before)
    expect(d.feedback).toEqual([
        { key: 'ping', feedback: 'alert' },
        { key: 'play', feedback: 'alert' },
    ])

    // The dashboard Pings dee while the deck is away.
    await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.queue.ping, { count: 1 })

    d.client.setConnected(true)
    await d.client.settle()

    expect(d.key('waitingCount')).toMatchObject({
        connection: 'live',
        title: '1',
        dimmed: false,
    })
    expect(d.key('pingedCount').title).toBe('3')
    expect(d.key('play').title).toBe('ada')
})

test('keys shown before the first update arrive grey until it does', async () => {
    const backend = await seed()
    const secret = await pairDeck(backend, 'owner-1')
    const d = await deck(backend, { secret: null })
    d.controller.showKey('w', 'waitingCount', {})
    d.client.setConnected(false)

    d.controller.setSecret(secret)
    expect(d.key('w')).toMatchObject({ connection: 'offline', dimmed: true })

    d.client.setConnected(true)
    await d.client.settle()
    expect(d.key('w')).toMatchObject({ connection: 'live', title: '2' })
})

test('a deck with no secret shows unpaired on every key and sends nothing', async () => {
    const backend = await seed()
    const d = await deck(backend, { secret: null })
    for (const [action] of everyAction) d.controller.showKey(action, action, {})

    for (const [action, icon] of everyAction) {
        expect(d.key(action)).toEqual({
            connection: 'unpaired',
            icon,
            title: 'unpaired',
            platform: null,
            dimmed: true,
            warning: false,
        })
    }
    const before = await readQueue(backend, 'owner-1')
    await d.press('openPause')
    expect(await readQueue(backend, 'owner-1')).toEqual(before)
    expect(d.feedback).toEqual([{ key: 'openPause', feedback: 'alert' }])
})

test('revoking the deck turns its keys unpaired, and pairing again recovers', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    d.controller.showKey('w', 'waitingCount', {})
    expect(d.key('w').connection).toBe('live')

    await revokeOnlyDeck(backend, 'owner-1')
    await d.client.refresh()

    expect(d.key('w')).toMatchObject({
        connection: 'unpaired',
        title: 'unpaired',
        dimmed: true,
    })
    expect(d.unpairedCalls).toHaveLength(1)

    d.controller.setSecret(await pairDeck(backend, 'owner-1'))
    await d.client.settle()
    expect(d.key('w')).toMatchObject({ connection: 'live', title: '2' })
})

test('a press refused because the deck was revoked warns and turns the keys unpaired', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    d.controller.showKey('ping', 'ping', {})
    d.controller.showKey('w', 'waitingCount', {})

    // Revoked, but the deck's live view hasn't caught up yet.
    await revokeOnlyDeck(backend, 'owner-1')
    await d.press('ping')

    expect(d.feedback).toEqual([{ key: 'ping', feedback: 'alert' }])
    expect(d.key('w').connection).toBe('unpaired')
    expect(d.unpairedCalls).toHaveLength(1)
})

test('a failed live view greys the keys until the next update', async () => {
    const backend = await seed()
    const d = await pairedDeck(backend)
    d.controller.showKey('w', 'waitingCount', {})

    d.client.failSubscriptions(new Error('query failed'))
    expect(d.key('w')).toMatchObject({ connection: 'offline', dimmed: true })
    await d.press('w')
    expect(d.feedback).toEqual([{ key: 'w', feedback: 'alert' }])

    await d.client.refresh()
    expect(d.key('w')).toMatchObject({ connection: 'live', title: '2' })
})
