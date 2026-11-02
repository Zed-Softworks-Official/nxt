import { internal } from '@nxt/backend/api'
import { expect, test } from 'vitest'

import { joinQ } from '~/commands/join'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    seedCommunity,
    seedDiscordCommunity,
    type TestBackend,
} from '~/test/queueHarness'
import { type AnnouncementSender, deliverPending } from './deliver'

const guild = { platform: 'discord', platformId: 'guild-1' } as const

function fakeSender() {
    const posts: { channelId: string; content: string }[] = []
    const sender: AnnouncementSender = {
        send: async (channelId, content) => {
            posts.push({ channelId, content })
        },
    }
    return { sender, posts }
}

async function joinIn(
    backend: TestBackend,
    channelId: string,
    userId: string,
    guildId = 'guild-1'
) {
    const { interaction } = fakeInteraction({
        guildId,
        channelId,
        userId,
        username: userId,
    })
    await joinQ.execute(interaction, asQueueConvex(backend))
}

test('a Pinged Participant is mentioned in the Command channel, once', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        commandChannelId: 'commands',
    })
    await joinIn(backend, 'commands', 'ada')
    await backend.mutation(internal.platformQueue.ping, {
        link: guild,
        count: 1,
    })
    const { sender, posts } = fakeSender()

    await deliverPending(asQueueConvex(backend), sender)
    await deliverPending(asQueueConvex(backend), sender)

    expect(posts).toEqual([
        { channelId: 'commands', content: "<@ada> you're up!" },
    ])
})

test('without a Command channel the mention goes where the Participant last joined', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    await joinIn(backend, 'general', 'ada')
    await joinIn(backend, 'lobby', 'bob')
    await backend.mutation(internal.platformQueue.ping, {
        link: guild,
        count: 2,
    })
    const { sender, posts } = fakeSender()

    await deliverPending(asQueueConvex(backend), sender)

    expect(posts).toEqual([
        { channelId: 'general', content: "<@ada> you're up!" },
        { channelId: 'lobby', content: "<@bob> you're up!" },
    ])
})

test('a Twitch Admin pinging a Discord Participant is announced in Discord', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [
            { ...guild, commandChannelId: 'commands' },
            { platform: 'twitch', platformId: 'broadcaster-1' },
        ],
    })
    await joinIn(backend, 'commands', 'ada')
    await backend.mutation(internal.platformQueue.ping, {
        link: { platform: 'twitch', platformId: 'broadcaster-1' },
        count: 1,
    })
    const { sender, posts } = fakeSender()

    await deliverPending(asQueueConvex(backend), sender)

    expect(posts).toEqual([
        { channelId: 'commands', content: "<@ada> you're up!" },
    ])
})

test('Announcements for a disabled guild link are dropped, not posted', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    await joinIn(backend, 'general', 'ada')
    await backend.mutation(internal.platformQueue.ping, {
        link: guild,
        count: 1,
    })
    await backend.run(async (ctx) => {
        const link = await ctx.db.query('platformLinks').first()
        if (link)
            await ctx.db.patch('platformLinks', link._id, { enabled: false })
    })
    const { sender, posts } = fakeSender()

    await deliverPending(asQueueConvex(backend), sender)

    expect(posts).toEqual([])
    expect(
        await backend.query(internal.announcements.pending, {
            platform: 'discord',
        })
    ).toEqual([])
})

test('a failed post stays pending and is retried on the next delivery', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    await joinIn(backend, 'general', 'ada')
    await backend.mutation(internal.platformQueue.ping, {
        link: guild,
        count: 1,
    })
    const failing: AnnouncementSender = {
        send: async () => {
            throw new Error('Discord is down')
        },
    }

    await deliverPending(asQueueConvex(backend), failing)
    const { sender, posts } = fakeSender()
    await deliverPending(asQueueConvex(backend), sender)

    expect(posts).toEqual([
        { channelId: 'general', content: "<@ada> you're up!" },
    ])
})
