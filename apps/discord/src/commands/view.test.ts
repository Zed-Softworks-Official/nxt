import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readQueue,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { viewQ } from './view'

test('viewq while the queue is open lists waiting usernames in join order', async () => {
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
            content: 'The queue is open.\n1. ada\n2. bob',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
            {
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
    const ada = 'a'.repeat(981)
    const bob = 'b'.repeat(981)
    const cy = 'c'.repeat(981)
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
            content: `The queue is open.\n1. ${ada}\n…and 2 more.`,
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                username: ada,
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
            {
                username: bob,
                platform: 'discord',
                platformUserId: 'user-2',
                status: 'waiting',
            },
            {
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
            content: 'The queue is paused.\n1. ada',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [
            {
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
            content: 'The queue is open.\n1. ada\n2. bob',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                username: 'pinged',
                platform: 'discord',
                platformUserId: 'user-pinged',
                status: 'notified',
            },
            {
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
            {
                username: 'playing',
                platform: 'discord',
                platformUserId: 'user-playing',
                status: 'playing',
            },
            {
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
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
        ],
    })
})
