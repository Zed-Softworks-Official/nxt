import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readQueue,
    seedCommunity,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { viewQ } from './view'

test('viewq while the queue is open lists waiting references, usernames, and platforms in join order', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'waiting',
            },
            {
                platformUserId: 'user-2',
                username: 'bob',
                status: 'waiting',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: 'anywhere',
    })

    await viewQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content:
                'The queue is open.\n1. q-1 ada (Discord)\n2. q-2 bob (Discord)',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                reference: 1,
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
            {
                reference: 2,
                username: 'bob',
                platform: 'discord',
                platformUserId: 'user-2',
                status: 'waiting',
            },
        ],
    })
})

test('viewq on an empty queue says nobody is waiting', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await viewQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'The queue is open.\nNobody is waiting.',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('viewq stops before the Discord message limit and keeps real positions', async () => {
    const backend = createTestBackend()
    // Each line is 984 characters: two fit alone, but not with "…and 1 more."
    const ada = 'a'.repeat(967)
    const bob = 'b'.repeat(967)
    const cy = 'c'.repeat(967)
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            { platformUserId: 'user-1', username: ada, status: 'waiting' },
            { platformUserId: 'user-2', username: bob, status: 'waiting' },
            { platformUserId: 'user-3', username: cy, status: 'waiting' },
        ],
    })
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await viewQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: `The queue is open.\n1. q-1 ${ada} (Discord)\n…and 2 more.`,
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                reference: 1,
                username: ada,
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
            {
                reference: 2,
                username: bob,
                platform: 'discord',
                platformUserId: 'user-2',
                status: 'waiting',
            },
            {
                reference: 3,
                username: cy,
                platform: 'discord',
                platformUserId: 'user-3',
                status: 'waiting',
            },
        ],
    })
})

test('viewq while the queue is paused still lists who is waiting', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'paused',
        participants: [
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'waiting',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await viewQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'The queue is paused.\n1. q-1 ada (Discord)',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [
            {
                reference: 1,
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
        ],
    })
})

test('viewq numbers only the waiting line and leaves pinged and playing in place', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            {
                platformUserId: 'user-pinged',
                username: 'pinged',
                status: 'notified',
            },
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'waiting',
            },
            {
                platformUserId: 'user-playing',
                username: 'playing',
                status: 'playing',
            },
            {
                platformUserId: 'user-2',
                username: 'bob',
                status: 'waiting',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await viewQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content:
                'The queue is open.\n1. q-2 ada (Discord)\n2. q-4 bob (Discord)',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                reference: 1,
                username: 'pinged',
                platform: 'discord',
                platformUserId: 'user-pinged',
                status: 'notified',
            },
            {
                reference: 2,
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
            {
                reference: 3,
                username: 'playing',
                platform: 'discord',
                platformUserId: 'user-playing',
                status: 'playing',
            },
            {
                reference: 4,
                username: 'bob',
                platform: 'discord',
                platformUserId: 'user-2',
                status: 'waiting',
            },
        ],
    })
})

test('viewq on a community with no queue shows a paused empty line', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'none',
    })
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await viewQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'The queue is paused.\nNobody is waiting.',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [],
    })
})

test('viewq in the wrong channel is only visible to the invoker', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        commandChannelId: '111',
        participants: [
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'waiting',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: '222',
    })

    await viewQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Queue commands go in <#111>.',
            ephemeral: true,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                reference: 1,
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
        ],
    })
})

test('viewq shows Twitch Participants sharing the Queue with their platform', async () => {
    const backend = createTestBackend()
    await seedCommunity(backend, {
        ownerId: 'owner-1',
        state: 'open',
        links: [
            { platform: 'discord', platformId: 'guild-1' },
            { platform: 'twitch', platformId: 'broadcaster-1' },
        ],
        participants: [
            {
                platformUserId: 't-1',
                username: 'bob_tv',
                status: 'waiting',
                platform: 'twitch',
            },
            { platformUserId: 'user-1', username: 'ada', status: 'waiting' },
        ],
    })
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await viewQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content:
                'The queue is open.\n1. q-1 bob_tv (Twitch)\n2. q-2 ada (Discord)',
            ephemeral: false,
        },
    ])
})
