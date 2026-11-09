import { api } from '@nxt/backend/api'
import { afterEach, expect, test } from 'vitest'

import {
    createTestBackend,
    installFakeTwitch,
    type SeedTwitchLink,
    seedCommunity,
    seedTwitchCommunity,
    type TestBackend,
} from '../testing'

let uninstall: (() => void) | null = null
afterEach(() => {
    uninstall?.()
    uninstall = null
})

async function channel(twitchLink: SeedTwitchLink = {}) {
    const backend = createTestBackend()
    const twitch = installFakeTwitch({})
    uninstall = twitch.uninstall
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        twitch: twitchLink,
    })
    return {
        backend,
        twitch,
        owner: backend.withIdentity({ subject: 'owner-1' }),
    }
}

async function requirement(backend: TestBackend) {
    const settings = await backend
        .withIdentity({ subject: 'owner-1' })
        .query(api.subRequirement.settings, {})
    return settings?.requirement
}

test('the owner can set the Sub requirement and it stays set', async () => {
    const { backend, owner } = await channel()

    expect(
        await owner.action(api.subRequirement.set, { requirement: 'tier2' })
    ).toEqual({ kind: 'ok' })

    expect(await requirement(backend)).toBe('tier2')
})

test('a link that has not reconnected cannot turn it on', async () => {
    const { backend, owner } = await channel({
        grant: { scopes: ['channel:bot'] },
    })

    expect(
        await owner.action(api.subRequirement.set, { requirement: 'any' })
    ).toEqual({ kind: 'needs_reconnect' })

    expect(await requirement(backend)).toBe('off')
})

test('a revoked grant cannot change it to another tier', async () => {
    const { backend, owner } = await channel({
        subRequirement: 'any',
        grantRevoked: true,
    })

    expect(
        await owner.action(api.subRequirement.set, { requirement: 'tier3' })
    ).toEqual({ kind: 'needs_reconnect' })

    expect(await requirement(backend)).toBe('any')
})

test('a channel that cannot have subs cannot turn it on', async () => {
    const { backend, owner, twitch } = await channel()
    twitch.setChannelsCanHaveSubs(false)

    expect(
        await owner.action(api.subRequirement.set, { requirement: 'any' })
    ).toEqual({ kind: 'not_eligible' })

    expect(await requirement(backend)).toBe('off')
})

test('when Twitch cannot say whether the channel can have subs, nothing changes', async () => {
    const { backend, owner, twitch } = await channel()
    twitch.setDown(true)

    expect(
        await owner.action(api.subRequirement.set, { requirement: 'any' })
    ).toEqual({ kind: 'check_failed' })

    expect(await requirement(backend)).toBe('off')
})

test('it can always be turned off, even with a revoked grant during an outage', async () => {
    const { backend, owner, twitch } = await channel({
        subRequirement: 'tier2',
        grantRevoked: true,
    })
    twitch.setDown(true)

    expect(
        await owner.action(api.subRequirement.set, { requirement: 'off' })
    ).toEqual({ kind: 'ok' })

    expect(await requirement(backend)).toBe('off')
})

test('without a linked Twitch channel there is nothing to set', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'open' })

    expect(
        await backend
            .withIdentity({ subject: 'owner-1' })
            .action(api.subRequirement.set, { requirement: 'any' })
    ).toEqual({ kind: 'unlinked' })
})

test('a signed-out caller cannot set it', async () => {
    const { backend } = await channel()

    await expect(
        backend.action(api.subRequirement.set, { requirement: 'off' })
    ).rejects.toThrow('Not signed in')
})
