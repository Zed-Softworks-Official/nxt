import { api } from '@nxt/backend/api'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
    createTestBackend,
    installFakeDiscord,
    readPlatformLinks,
    seedCommunity,
    type TestBackend,
} from '../testing'

// Each authorization code installs the bot in one guild. `code-guild-N`
// installs it in `guild-N`.
let uninstall: (() => void) | null = null
beforeEach(() => {
    uninstall = installFakeDiscord({
        'code-guild-1': { guildId: 'guild-1' },
        'code-guild-2': { guildId: 'guild-2' },
    }).uninstall
})
afterEach(() => {
    uninstall?.()
    uninstall = null
})

async function mintDiscordState(backend: TestBackend, ownerId: string) {
    return await backend
        .withIdentity({ subject: ownerId })
        .mutation(api.linkStates.mintLinkState, { platform: 'discord' })
}

// Discord redirects back with `code`, `state` and `guild_id`. Only the guild
// in the code exchange's response is trusted; `guild_id` is ignored.
function discordCallback(
    state: string,
    guildId = 'guild-1',
    query: Record<string, string> = {}
) {
    const params = new URLSearchParams({
        state,
        code: `code-${guildId}`,
        guild_id: guildId,
        ...query,
    })
    return `/discord?${params.toString()}`
}

function redirectType(response: Response) {
    const location = response.headers.get('location')
    return location ? new URL(location).searchParams.get('type') : null
}

test('a valid state links the guild to the Community of the owner who minted it', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    await seedCommunity(backend, { ownerId: 'owner-2', state: 'none' })
    const state = await mintDiscordState(backend, 'owner-1')

    const response = await backend.fetch(discordCallback(state), {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('success')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([
        { platform: 'discord', platformId: 'guild-1', enabled: true },
    ])
    expect(await readPlatformLinks(backend, 'owner-2')).toEqual([])
})

test('a forged state is refused and links nothing', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintDiscordState(backend, 'owner-1')
    const [id] = state.split('.')

    for (const forged of [
        `${id}.not-the-signature`,
        `${id}`,
        'garbage',
        'k57c3e5x2b0b0b0b0b0b0b0b0b0b0b0b.c2lnbmF0dXJl',
    ]) {
        const response = await backend.fetch(discordCallback(forged), {
            redirect: 'manual',
        })
        expect(redirectType(response)).toBe('error')
    }
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([])
})

test('a community ID passed as the state is refused', async () => {
    const backend = createTestBackend()
    const communityId = await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'none',
    })

    const response = await backend.fetch(discordCallback(communityId), {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('error')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([])
})

test('a reused state is refused and leaves the first link alone', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintDiscordState(backend, 'owner-1')
    await backend.fetch(discordCallback(state, 'guild-1'), {
        redirect: 'manual',
    })

    const response = await backend.fetch(discordCallback(state, 'guild-2'), {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('error')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([
        { platform: 'discord', platformId: 'guild-1', enabled: true },
    ])
})

test('an expired state is refused and links nothing', async () => {
    vi.useFakeTimers()
    try {
        const backend = createTestBackend()
        await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
        const state = await mintDiscordState(backend, 'owner-1')
        vi.advanceTimersByTime(11 * 60 * 1000)

        const response = await backend.fetch(discordCallback(state), {
            redirect: 'manual',
        })

        expect(redirectType(response)).toBe('error')
        expect(await readPlatformLinks(backend, 'owner-1')).toEqual([])
    } finally {
        vi.useRealTimers()
    }
})

test('a state minted for another platform is refused for Discord', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.linkStates.mintLinkState, { platform: 'twitch' })

    const response = await backend.fetch(discordCallback(state), {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('error')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([])
})

test('a callback with no state is refused', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })

    const response = await backend.fetch('/discord?guild_id=guild-1', {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('error')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([])
})

test('only a signed-in Community owner can mint a state', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })

    await expect(
        backend.mutation(api.linkStates.mintLinkState, { platform: 'discord' })
    ).rejects.toThrow('Not signed in')
    await expect(
        backend
            .withIdentity({ subject: 'stranger' })
            .mutation(api.linkStates.mintLinkState, { platform: 'discord' })
    ).rejects.toThrow('Community not found')
})

test('the guild comes from the code exchange, not the guild_id in the query', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintDiscordState(backend, 'owner-1')

    const response = await backend.fetch(
        discordCallback(state, 'guild-1', { guild_id: 'someone-elses-guild' }),
        { redirect: 'manual' }
    )

    expect(redirectType(response)).toBe('success')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([
        { platform: 'discord', platformId: 'guild-1', enabled: true },
    ])
})

test('a code Discord refuses links nothing', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintDiscordState(backend, 'owner-1')

    const response = await backend.fetch(
        discordCallback(state, 'guild-1', { code: 'not-a-code' }),
        { redirect: 'manual' }
    )

    expect(redirectType(response)).toBe('error')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([])
})

test('a callback with no code is refused', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'none' })
    const state = await mintDiscordState(backend, 'owner-1')
    const params = new URLSearchParams({ state, guild_id: 'guild-1' })

    const response = await backend.fetch(`/discord?${params.toString()}`, {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('error')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([])
})

test('a guild linked to another Community is refused', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'none',
        links: [{ platform: 'discord', platformId: 'guild-1' }],
    })
    await seedCommunity(backend, { ownerId: 'owner-2', state: 'none' })
    const state = await mintDiscordState(backend, 'owner-2')

    const response = await backend.fetch(discordCallback(state, 'guild-1'), {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('error')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([
        { platform: 'discord', platformId: 'guild-1', enabled: true },
    ])
    expect(await readPlatformLinks(backend, 'owner-2')).toEqual([])
})

test('relinking a guild the Community already has keeps one link', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'none',
        links: [{ platform: 'discord', platformId: 'guild-1', enabled: false }],
    })
    const state = await mintDiscordState(backend, 'owner-1')

    const response = await backend.fetch(discordCallback(state, 'guild-1'), {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('success')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([
        { platform: 'discord', platformId: 'guild-1', enabled: true },
    ])
})
