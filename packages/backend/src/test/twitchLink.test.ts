import { api, internal } from '@nxt/backend/api'
import { afterEach, expect, test } from 'vitest'

import {
    createTestBackend,
    installFakeTwitch,
    readQueue,
    seedCommunity,
    type TestBackend,
} from '../testing'

let uninstall: (() => void) | null = null
afterEach(() => {
    uninstall?.()
    uninstall = null
})

function fakeTwitch(signIns: Parameters<typeof installFakeTwitch>[0]) {
    const twitch = installFakeTwitch(signIns)
    uninstall = twitch.uninstall
    return twitch
}

const broadcaster = {
    id: 'broadcaster-1',
    login: 'streamer',
    displayName: 'Streamer',
}

async function mintTwitchState(backend: TestBackend, ownerId: string) {
    return await backend
        .withIdentity({ subject: ownerId })
        .mutation(api.linkStates.mintLinkState, { platform: 'twitch' })
}

// Twitch redirects back with `code`, `scope` and `state` on success, or with
// `error`, `error_description` and `state` when the user cancels.
async function twitchCallback(
    backend: TestBackend,
    params: Record<string, string>
) {
    const query = new URLSearchParams(params)
    const response = await backend.fetch(`/twitch?${query.toString()}`, {
        redirect: 'manual',
    })
    const location = response.headers.get('location')
    return location ? new URL(location).searchParams.get('type') : null
}

async function dashboardLinks(backend: TestBackend, ownerId: string) {
    return await backend.query(api.platformLinks.getPlatformLinks, { ownerId })
}

test('a valid sign-in links the broadcaster channel and subscribes to its chat', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({ 'code-1': { user: broadcaster } })
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintTwitchState(backend, 'owner-1')

    const result = await twitchCallback(backend, {
        code: 'code-1',
        scope: 'channel:bot',
        state,
    })

    expect(result).toBe('success')
    expect(await dashboardLinks(backend, 'owner-1')).toEqual([
        {
            platform: 'twitch',
            platformId: 'broadcaster-1',
            platformName: 'Twitch',
            channelName: 'Streamer',
            enabled: true,
        },
    ])
    expect(twitch.subscribedChannels()).toEqual(['broadcaster-1'])
})

test('a forged state is refused, links nothing and subscribes to nothing', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({ 'code-1': { user: broadcaster } })
    const communityId = await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'none',
    })
    const [id] = (await mintTwitchState(backend, 'owner-1')).split('.')

    for (const forged of [`${id}.not-the-signature`, 'garbage', communityId]) {
        const result = await twitchCallback(backend, {
            code: 'code-1',
            scope: 'channel:bot',
            state: forged,
        })
        expect(result).toBe('error')
    }
    expect(await twitchCallback(backend, { code: 'code-1' })).toBe('error')
    expect(await dashboardLinks(backend, 'owner-1')).toEqual([])
    expect(twitch.subscribedChannels()).toEqual([])
})

test('a reused state is refused and leaves the first link alone', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({
        'code-1': { user: broadcaster },
        'code-2': {
            user: { id: 'broadcaster-2', login: 'other', displayName: 'Other' },
        },
    })
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintTwitchState(backend, 'owner-1')
    await twitchCallback(backend, { code: 'code-1', state })

    const result = await twitchCallback(backend, { code: 'code-2', state })

    expect(result).toBe('error')
    expect(await dashboardLinks(backend, 'owner-1')).toMatchObject([
        { platformId: 'broadcaster-1', enabled: true },
    ])
    expect(twitch.subscribedChannels()).toEqual(['broadcaster-1'])
})

test('a state minted for Discord is refused for Twitch', async () => {
    const backend = createTestBackend()
    fakeTwitch({ 'code-1': { user: broadcaster } })
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.linkStates.mintLinkState, { platform: 'discord' })

    expect(await twitchCallback(backend, { code: 'code-1', state })).toBe(
        'error'
    )
    expect(await dashboardLinks(backend, 'owner-1')).toEqual([])
})

test('a cancelled sign-in redirects with an error and links nothing', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({})
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintTwitchState(backend, 'owner-1')

    const result = await twitchCallback(backend, {
        error: 'access_denied',
        error_description: 'The user denied you access',
        state,
    })

    expect(result).toBe('error')
    expect(await dashboardLinks(backend, 'owner-1')).toEqual([])
    expect(twitch.subscribedChannels()).toEqual([])
})

test('a failed code exchange redirects with an error and leaves links unchanged', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({})
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'none',
        links: [{ platform: 'discord', platformId: 'guild-1' }],
    })
    const state = await mintTwitchState(backend, 'owner-1')

    const result = await twitchCallback(backend, { code: 'bad-code', state })

    expect(result).toBe('error')
    expect(await dashboardLinks(backend, 'owner-1')).toEqual([
        {
            platform: 'discord',
            platformId: 'guild-1',
            platformName: 'Discord',
            enabled: true,
        },
    ])
    expect(twitch.subscribedChannels()).toEqual([])
})

test('a grant without the broadcaster channel:bot consent is refused', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({
        'code-1': { user: broadcaster, scopes: ['user:read:email'] },
    })
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintTwitchState(backend, 'owner-1')

    const result = await twitchCallback(backend, { code: 'code-1', state })

    expect(result).toBe('error')
    expect(await dashboardLinks(backend, 'owner-1')).toEqual([])
    expect(twitch.subscribedChannels()).toEqual([])
})

test('a moderator who signs in links their own channel, never the one they moderate', async () => {
    const backend = createTestBackend()
    const moderator = { id: 'moderator-1', login: 'mod', displayName: 'Mod' }
    fakeTwitch({ 'code-1': { user: moderator } })
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintTwitchState(backend, 'owner-1')

    await twitchCallback(backend, { code: 'code-1', state })

    expect(await dashboardLinks(backend, 'owner-1')).toMatchObject([
        { platform: 'twitch', platformId: 'moderator-1', channelName: 'Mod' },
    ])
})

test('a channel already linked to another Community is refused', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({ 'code-1': { user: broadcaster } })
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    await seedCommunity(backend, { ownerId: 'owner-2', state: 'none' })
    await twitchCallback(backend, {
        code: 'code-1',
        state: await mintTwitchState(backend, 'owner-1'),
    })

    const result = await twitchCallback(backend, {
        code: 'code-1',
        state: await mintTwitchState(backend, 'owner-2'),
    })

    expect(result).toBe('error')
    expect(await dashboardLinks(backend, 'owner-2')).toEqual([])
    expect(await dashboardLinks(backend, 'owner-1')).toMatchObject([
        { platformId: 'broadcaster-1', enabled: true },
    ])
    expect(twitch.subscribedChannels()).toEqual(['broadcaster-1'])
})

// ---- Unlinking ------------------------------------------------------------

async function linkTwitch(backend: TestBackend, ownerId: string, code: string) {
    const result = await twitchCallback(backend, {
        code,
        state: await mintTwitchState(backend, ownerId),
    })
    expect(result).toBe('success')
}

function unlinkAs(backend: TestBackend, ownerId: string) {
    return backend
        .withIdentity({ subject: ownerId })
        .action(api.twitchLink.unlink, {})
}

test('unlinking disables the link, stops listening and deletes the chat subscription', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({ 'code-1': { user: broadcaster } })
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'open' })
    await linkTwitch(backend, 'owner-1', 'code-1')

    await unlinkAs(backend, 'owner-1')

    expect(await dashboardLinks(backend, 'owner-1')).toMatchObject([
        { platform: 'twitch', platformId: 'broadcaster-1', enabled: false },
    ])
    expect(await backend.query(internal.twitchChannels.linked, {})).toEqual([])
    expect(twitch.subscribedChannels()).toEqual([])
})

test('unlinking removes waiting Twitch Participants and keeps Pinged, Playing and other platforms', async () => {
    const backend = createTestBackend()
    fakeTwitch({ 'code-1': { user: broadcaster } })
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [{ platform: 'discord', platformId: 'guild-1' }],
        participants: [
            { platformUserId: 't-1', username: 'waiter', status: 'waiting', platform: 'twitch' },
            { platformUserId: 't-2', username: 'called', status: 'notified', platform: 'twitch' },
            { platformUserId: 't-3', username: 'player', status: 'playing', platform: 'twitch' },
            { platformUserId: 'd-1', username: 'discorder', status: 'waiting', platform: 'discord' },
        ],
    })
    await linkTwitch(backend, 'owner-1', 'code-1')

    await unlinkAs(backend, 'owner-1')

    const queue = await readQueue(backend, 'owner-1')
    expect(
        queue?.participants.map(({ username, status }) => ({ username, status }))
    ).toEqual([
        { username: 'called', status: 'notified' },
        { username: 'player', status: 'playing' },
        { username: 'discorder', status: 'waiting' },
    ])
    expect(await dashboardLinks(backend, 'owner-1')).toMatchObject([
        { platform: 'discord', enabled: true },
        { platform: 'twitch', enabled: false },
    ])
})

test('unlinking drops pending Twitch Announcements so they are never posted', async () => {
    const backend = createTestBackend()
    fakeTwitch({ 'code-1': { user: broadcaster } })
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        participants: [
            { platformUserId: 't-1', username: 'viewer', status: 'waiting', platform: 'twitch' },
        ],
    })
    await linkTwitch(backend, 'owner-1', 'code-1')
    await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.queue.ping, { count: 1 })
    expect(
        await backend.query(internal.announcements.pending, { platform: 'twitch' })
    ).toMatchObject([{ action: 'post' }])

    await unlinkAs(backend, 'owner-1')

    expect(
        await backend.query(internal.announcements.pending, { platform: 'twitch' })
    ).toEqual([])
})

test('only the signed-in Community owner can unlink their own channel', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({ 'code-1': { user: broadcaster } })
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'open' })
    await seedCommunity(backend, { ownerId: 'owner-2', state: 'open' })
    await linkTwitch(backend, 'owner-1', 'code-1')

    await expect(
        backend.action(api.twitchLink.unlink, {})
    ).rejects.toThrow('Not signed in')
    await unlinkAs(backend, 'owner-2')

    expect(await dashboardLinks(backend, 'owner-1')).toMatchObject([
        { platformId: 'broadcaster-1', enabled: true },
    ])
    expect(twitch.subscribedChannels()).toEqual(['broadcaster-1'])
})

test('an unlinked channel can be linked again, by the same or another Community', async () => {
    const backend = createTestBackend()
    const twitch = fakeTwitch({ 'code-1': { user: broadcaster } })
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'open' })
    await seedCommunity(backend, { ownerId: 'owner-2', state: 'open' })
    await linkTwitch(backend, 'owner-1', 'code-1')
    await unlinkAs(backend, 'owner-1')

    await linkTwitch(backend, 'owner-2', 'code-1')

    expect(await dashboardLinks(backend, 'owner-1')).toEqual([])
    expect(await dashboardLinks(backend, 'owner-2')).toMatchObject([
        { platformId: 'broadcaster-1', channelName: 'Streamer', enabled: true },
    ])
    expect(await backend.query(internal.twitchChannels.linked, {})).toEqual([
        'broadcaster-1',
    ])
    expect(twitch.subscribedChannels()).toEqual(['broadcaster-1'])
})
