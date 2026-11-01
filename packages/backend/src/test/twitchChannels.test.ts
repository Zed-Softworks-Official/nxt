import { internal } from '@nxt/backend/api'
import { expect, test } from 'vitest'

import {
    createTestBackend,
    seedCommunity,
    seedDiscordCommunity,
    seedTwitchCommunity,
} from '../testing'

test('linked Twitch channels are the broadcaster IDs of enabled Twitch links', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-a',
        broadcasterId: 'broadcaster-a',
        state: 'open',
    })
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-b',
        broadcasterId: 'broadcaster-b',
        state: 'paused',
        enabled: false,
    })
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-c',
        guildId: 'guild-c',
        state: 'open',
    })
    await seedCommunity(backend, {
        ownerId: 'owner-d',
        state: 'none',
        links: [{ platform: 'twitch', platformId: 'broadcaster-d' }],
    })

    const channels = await backend.query(internal.twitchChannels.linked, {})

    expect([...channels].sort()).toEqual(['broadcaster-a', 'broadcaster-d'])
})
