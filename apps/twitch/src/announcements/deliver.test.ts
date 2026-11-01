import { api, internal } from '@nxt/backend/api'
import { expect, test } from 'vitest'

import {
    asQueueConvex,
    chatMessage,
    createTestBackend,
    fakeSender,
    seedCommunity,
    seedTwitchCommunity,
    twitchBot,
} from '~/test/chatHarness'
import { deliverPending } from './deliver'

const twitch = { platform: 'twitch', platformId: 'broadcaster-1' } as const
const guild = { platform: 'discord', platformId: 'guild-1' } as const

test('a Twitch Participant Pinged from Discord is @mentioned in the channel, once', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [guild, twitch],
    })
    await twitchBot(backend).handle(chatMessage('!nxt join'))
    await backend.mutation(internal.platformQueue.ping, {
        link: guild,
        count: 1,
    })
    const { sender, sent } = fakeSender()

    await deliverPending(asQueueConvex(backend), sender)
    await deliverPending(asQueueConvex(backend), sender)

    expect(sent).toEqual([
        {
            kind: 'say',
            channelId: 'broadcaster-1',
            text: "@Ada you're up! (q-1)",
        },
    ])
})

test('a Ping from the dashboard is announced exactly like one from chat', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const bot = twitchBot(backend)
    await bot.handle(chatMessage('!nxt join'))
    await bot.handle(
        chatMessage('!nxt join', {
            chatterId: 'user-2',
            chatterLogin: 'bob',
            chatterName: 'Bob',
        })
    )
    await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.queue.ping, { count: 2 })
    const { sender, sent } = fakeSender()

    await deliverPending(asQueueConvex(backend), sender)

    expect(sent.map((entry) => entry.text)).toEqual([
        "@Ada you're up! (q-1)",
        "@Bob you're up! (q-2)",
    ])
})

test('Announcements for an unlinked Twitch channel are dropped, not posted', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    await twitchBot(backend).handle(chatMessage('!nxt join'))
    await backend.mutation(internal.platformQueue.ping, {
        link: twitch,
        count: 1,
    })
    await backend.run(async (ctx) => {
        const link = await ctx.db.query('platformLinks').first()
        if (link)
            await ctx.db.patch('platformLinks', link._id, { enabled: false })
    })
    const { sender, sent } = fakeSender()

    await deliverPending(asQueueConvex(backend), sender)

    expect(sent).toEqual([])
    expect(
        await backend.query(internal.announcements.pending, {
            platform: 'twitch',
        })
    ).toEqual([])
})

test('a failed post stays pending and is retried on the next delivery', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    await twitchBot(backend).handle(chatMessage('!nxt join'))
    await backend.mutation(internal.platformQueue.ping, {
        link: twitch,
        count: 1,
    })
    const failing = {
        say: async () => {
            throw new Error('Twitch is down')
        },
    }

    await deliverPending(asQueueConvex(backend), failing)
    const { sender, sent } = fakeSender()
    await deliverPending(asQueueConvex(backend), sender)

    expect(sent.map((entry) => entry.text)).toEqual(["@Ada you're up! (q-1)"])
})
