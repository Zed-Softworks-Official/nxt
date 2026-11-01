import { api } from '@nxt/backend/api'
import { expect, test, vi } from 'vitest'
import {
    createTestBackend,
    readPlatformLinks,
    seedCommunity,
    type TestBackend,
} from './backend'

async function mintDiscordState(backend: TestBackend, ownerId: string) {
    return await backend
        .withIdentity({ subject: ownerId })
        .mutation(api.linkStates.mintLinkState, { platform: 'discord' })
}

function discordCallback(state: string, guildId = 'guild-1') {
    const params = new URLSearchParams({ state, guild_id: guildId })
    return `/discord?${params.toString()}`
}

function redirectType(response: Response) {
    const location = response.headers.get('location')
    return location ? new URL(location).searchParams.get('type') : null
}

test('a valid state links the guild to the Community of the owner who minted it', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, 'owner-1')
    await seedCommunity(backend, 'owner-2')
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
    await seedCommunity(backend, 'owner-1')
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
    const communityId = await seedCommunity(backend, 'owner-1')

    const response = await backend.fetch(discordCallback(communityId), {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('error')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([])
})

test('a reused state is refused and leaves the first link alone', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, 'owner-1')
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
        await seedCommunity(backend, 'owner-1')
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
    await seedCommunity(backend, 'owner-1')
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
    await seedCommunity(backend, 'owner-1')

    const response = await backend.fetch('/discord?guild_id=guild-1', {
        redirect: 'manual',
    })

    expect(redirectType(response)).toBe('error')
    expect(await readPlatformLinks(backend, 'owner-1')).toEqual([])
})

test('only a signed-in Community owner can mint a state', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, 'owner-1')

    await expect(
        backend.mutation(api.linkStates.mintLinkState, { platform: 'discord' })
    ).rejects.toThrow('Not signed in')
    await expect(
        backend
            .withIdentity({ subject: 'stranger' })
            .mutation(api.linkStates.mintLinkState, { platform: 'discord' })
    ).rejects.toThrow('Community not found')
})
