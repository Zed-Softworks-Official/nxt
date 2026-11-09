import { api } from '@nxt/backend/api'
import { afterEach, expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    installFakeTwitch,
    readQueue,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

const COOLDOWN_MS = 15_000

let uninstall: (() => void) | null = null
afterEach(() => {
    uninstall?.()
    uninstall = null
})

type SeedInput = Parameters<typeof seedTwitchCommunity>[1]

async function channel(input: Partial<SeedInput> = {}) {
    const backend = createTestBackend()
    const twitch = installFakeTwitch({})
    uninstall = twitch.uninstall
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        ...input,
    })
    return { backend, twitch }
}

async function waitingCount(backend: ReturnType<typeof createTestBackend>) {
    return (await readQueue(backend, 'owner-1'))?.participants.length
}

test.each([
    ['any', 1, 'in'],
    ['any', 3, 'in'],
    ['tier2', 2, 'in'],
    ['tier2', 3, 'in'],
    ['tier3', 3, 'in'],
    ['tier2', 1, 'out'],
    ['tier3', 2, 'out'],
] as const)('with the Sub requirement at %s, a Tier %i sub is %s', async (requirement, tier, outcome) => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: requirement },
    })
    twitch.setSub('user-1', tier)
    const { handle } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(await waitingCount(backend)).toBe(outcome === 'in' ? 1 : 0)
})

test.each([
    ['any', 'This queue requires a sub to join.'],
    ['tier2', 'This queue requires a Tier 2 or higher sub to join.'],
    ['tier3', 'This queue requires a Tier 3 sub to join.'],
] as const)('someone without a sub is refused at %s and told what is needed', async (requirement, reply) => {
    const { backend } = await channel({
        twitch: { subRequirement: requirement },
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([`@ada ${reply}`])
    expect(await waitingCount(backend)).toBe(0)
})

test('a subscriber who joins gets the usual reply', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'any' },
    })
    twitch.setSub('user-1', 1)
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada You joined the queue as q-1.',
    ])
})

test('moderators and the broadcaster join without a sub or a check', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'tier3' },
    })
    const { handle } = twitchBot(backend)

    await handle(chatMessage('!joinq', { badges: { moderator: '1' } }))
    await handle(
        chatMessage('!joinq', {
            chatterId: 'broadcaster-1',
            chatterLogin: 'streamer',
        })
    )

    expect(await waitingCount(backend)).toBe(2)
    expect(twitch.subCheckTokens()).toEqual([])
})

test('a VIP still needs to meet the Sub requirement', async () => {
    const { backend } = await channel({ twitch: { subRequirement: 'any' } })
    const { handle } = twitchBot(backend)

    await handle(chatMessage('!joinq', { badges: { vip: '1' } }))

    expect(await waitingCount(backend)).toBe(0)
})

test('someone already waiting is told so without a check, even without a sub', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'tier3' },
        participants: [
            { platformUserId: 'user-1', username: 'Ada', status: 'waiting' },
        ],
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada You are already in the queue as q-1.',
    ])
    expect(twitch.subCheckTokens()).toEqual([])
})

test('a Paused Queue says paused without a check', async () => {
    const { backend, twitch } = await channel({
        state: 'paused',
        twitch: { subRequirement: 'any' },
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada The queue is paused, so you cannot join right now.',
    ])
    expect(twitch.subCheckTokens()).toEqual([])
})

test('Joins off says so without a check', async () => {
    const { backend, twitch } = await channel({
        joinsOff: true,
        twitch: { subRequirement: 'any' },
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Joining from Twitch is off right now.',
    ])
    expect(twitch.subCheckTokens()).toEqual([])
})

test('with the Sub requirement Off, nobody is checked', async () => {
    const { backend, twitch } = await channel({ twitch: {} })
    const { handle } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(await waitingCount(backend)).toBe(1)
    expect(twitch.subCheckTokens()).toEqual([])
})

test('when Twitch cannot answer, the join is refused honestly and the requirement stays on', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'any' },
    })
    twitch.setSub('user-1', 1)
    twitch.setDown(true)
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        "@ada Couldn't check your subscription, try again.",
    ])
    expect(await waitingCount(backend)).toBe(0)
})

test('a refused person is quiet and unchecked for the cooldown, then checked again', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'any' },
    })
    const clock = { now: 1_000_000 }
    const { handle, sent } = twitchBot(backend, { now: () => clock.now })

    await handle(chatMessage('!joinq'))
    await handle(chatMessage('!joinq'))
    expect(sent).toHaveLength(1)
    expect(twitch.subCheckTokens()).toHaveLength(1)

    clock.now += COOLDOWN_MS
    twitch.setSub('user-1', 1)
    await handle(chatMessage('!joinq'))

    expect(sent.at(-1)?.text).toBe('@ada You joined the queue as q-1.')
})

test('a successful join does not start the cooldown', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'any' },
    })
    twitch.setSub('user-1', 1)
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))
    await handle(chatMessage('!joinq'))

    expect(sent.at(-1)?.text).toBe('@ada You are already in the queue as q-1.')
})

// ---- The broadcaster's grant (ADR-0006) ---------------------------------------

const EXPIRED = { expiresAt: 1 }

async function reconnectNeeded(backend: ReturnType<typeof createTestBackend>) {
    const settings = await backend
        .withIdentity({ subject: 'owner-1' })
        .query(api.subRequirement.settings, {})
    return settings?.needsReconnect
}

test('an expired grant is refreshed, then the new token is kept for later checks', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'any', grant: EXPIRED },
    })
    twitch.setSub('user-1', 1)
    twitch.setSub('user-2', 1)
    const { handle } = twitchBot(backend)

    await handle(chatMessage('!joinq'))
    await handle(chatMessage('!joinq', { chatterId: 'user-2' }))

    expect(await waitingCount(backend)).toBe(2)
    expect(twitch.refreshCount()).toBe(1)
    expect(twitch.subCheckTokens()).toEqual([
        'refreshed-access-1',
        'refreshed-access-1',
    ])
})

test('a token Twitch rejects before its expiry is refreshed and the check retried', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'any' },
    })
    twitch.setSub('user-1', 1)
    twitch.rejectAccessToken('seed-access')
    const { handle } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(await waitingCount(backend)).toBe(1)
    expect(twitch.subCheckTokens()).toEqual([
        'seed-access',
        'refreshed-access-1',
    ])
})

test('two joins racing on an expired grant refresh it once and both get in', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'any', grant: EXPIRED },
    })
    twitch.setSub('user-1', 1)
    twitch.setSub('user-2', 1)
    const { handle } = twitchBot(backend)

    await Promise.all([
        handle(chatMessage('!joinq')),
        handle(chatMessage('!joinq', { chatterId: 'user-2' })),
    ])

    expect(await waitingCount(backend)).toBe(2)
    expect(twitch.refreshCount()).toBe(1)
    expect(await reconnectNeeded(backend)).toBe(false)
})

test('a revoked grant refuses honestly, keeps the requirement on and asks for a Reconnect', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'tier2' },
    })
    twitch.setSub('user-1', 3)
    twitch.revokeGrant()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        "@ada Couldn't check your subscription, try again.",
    ])
    expect(await waitingCount(backend)).toBe(0)
    expect(
        await backend
            .withIdentity({ subject: 'owner-1' })
            .query(api.subRequirement.settings, {})
    ).toEqual({ requirement: 'tier2', needsReconnect: true })
})

test('once a grant is known to be revoked, joins stop calling Twitch', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'any', grantRevoked: true },
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        "@ada Couldn't check your subscription, try again.",
    ])
    expect(twitch.subCheckTokens()).toEqual([])
})

test('an outage during a refresh is not treated as a revoked grant', async () => {
    const { backend, twitch } = await channel({
        twitch: { subRequirement: 'any', grant: EXPIRED },
    })
    twitch.setSub('user-1', 1)
    twitch.setDown(true)
    const clock = { now: 1_000_000 }
    const { handle, sent } = twitchBot(backend, { now: () => clock.now })

    await handle(chatMessage('!joinq'))

    expect(sent.at(-1)?.text).toBe(
        "@ada Couldn't check your subscription, try again."
    )
    expect(await reconnectNeeded(backend)).toBe(false)

    twitch.setDown(false)
    clock.now += COOLDOWN_MS
    await handle(chatMessage('!joinq'))

    expect(await waitingCount(backend)).toBe(1)
})

// ---- !subq --------------------------------------------------------------------

const MODERATOR = { badges: { moderator: '1' } }

test('!subq tells anyone the current setting', async () => {
    const { backend } = await channel({ twitch: { subRequirement: 'tier2' } })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada The Sub requirement is Tier 2 and up.',
    ])
})

test('!subq reads Off on a link that has not reconnected', async () => {
    const { backend } = await channel({
        twitch: { grant: { scopes: ['channel:bot'] } },
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada The Sub requirement is Off.',
    ])
})

test('asking with !subq is on the cooldown', async () => {
    const { backend } = await channel({ twitch: {} })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq'))
    await handle(chatMessage('!subq'))

    expect(sent).toHaveLength(1)
})

test.each([
    ['off', 'Off'],
    ['any', 'Any sub'],
    ['2', 'Tier 2 and up'],
    ['3', 'Tier 3'],
])('a moderator running !subq %s sets %s', async (arg, label) => {
    const { backend } = await channel({ twitch: {} })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage(`!subq ${arg}`, MODERATOR))
    await handle(chatMessage('!subq', { chatterId: 'user-2' }))

    expect(sent.map((entry) => entry.text)).toEqual([
        `@ada The Sub requirement is now ${label}.`,
        `@ada The Sub requirement is ${label}.`,
    ])
})

test('an Admin can change it twice in a row without hitting the cooldown', async () => {
    const { backend } = await channel({ twitch: {} })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq 2', MODERATOR))
    await handle(chatMessage('!subq 3', MODERATOR))

    expect(sent.at(-1)?.text).toBe('@ada The Sub requirement is now Tier 3.')
})

test('setting it through !subq applies to the next join', async () => {
    const { backend } = await channel({ twitch: {} })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq any', MODERATOR))
    await handle(chatMessage('!joinq'))

    expect(sent.at(-1)?.text).toBe('@ada This queue requires a sub to join.')
})

test('someone who is not an Admin cannot change it', async () => {
    const { backend } = await channel({ twitch: { subRequirement: 'any' } })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq off'))
    await handle(chatMessage('!subq', { chatterId: 'user-2' }))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Only the broadcaster and moderators can run !subq.',
        '@ada The Sub requirement is Any sub.',
    ])
})

test('an unknown setting gets the usage and changes nothing', async () => {
    const { backend } = await channel({ twitch: { subRequirement: 'any' } })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq 5', MODERATOR))
    await handle(chatMessage('!subq', { chatterId: 'user-2' }))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Usage: !subq off|any|2|3',
        '@ada The Sub requirement is Any sub.',
    ])
})

test('!subq on a link that has not reconnected points to the dashboard', async () => {
    const { backend } = await channel({
        twitch: { grant: { scopes: ['channel:bot'] } },
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq 2', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada The Community owner needs to reconnect Twitch in the dashboard first.',
    ])
})

test('!subq on a channel that cannot have subs says so', async () => {
    const { backend, twitch } = await channel({ twitch: {} })
    twitch.setChannelsCanHaveSubs(false)
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq 2', MODERATOR))

    expect(sent.map((entry) => entry.text)).toEqual([
        "@ada This channel can't have subs yet, so the Sub requirement was not changed.",
    ])
})

test('!subq stays silent in a channel with no enabled Platform Link', async () => {
    const { backend } = await channel({ enabled: false, twitch: {} })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!subq'))
    await handle(chatMessage('!subq 2', MODERATOR))

    expect(sent).toEqual([])
})

test('!nxt lists !subq', async () => {
    const { backend } = await channel({ twitch: {} })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt'))
    await handle(chatMessage('!nxt', MODERATOR))

    expect(sent[0]?.text).toContain('!subq')
    expect(sent[1]?.text).toContain('!subq [off|any|2|3]')
})
