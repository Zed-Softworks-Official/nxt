import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readQueue,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { clearQ } from './clear'

test('clearq without Manage Server refuses and leaves the waiting line', async () => {
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
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        userId: 'user-1',
    })

    await clearQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'You need Manage Server to do that.',
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
        ],
    })
})

test('clearq removes waiting participants and leaves pinged and playing', async () => {
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
            {
                platformUserId: 'user-2',
                username: 'bea',
                status: 'waiting',
            },
            {
                platformUserId: 'user-3',
                username: 'cy',
                status: 'waiting',
            },
            {
                platformUserId: 'user-4',
                username: 'dee',
                status: 'waiting',
            },
            {
                platformUserId: 'user-5',
                username: 'eve',
                status: 'notified',
            },
            {
                platformUserId: 'user-6',
                username: 'frank',
                status: 'playing',
            },
            {
                platformUserId: 'user-7',
                username: 'gus',
                status: 'done',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: '222',
        manageServer: true,
    })

    await clearQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Cleared 4 from the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                reference: 5,
                username: 'eve',
                platform: 'discord',
                platformUserId: 'user-5',
                status: 'notified',
            },
            {
                reference: 6,
                username: 'frank',
                platform: 'discord',
                platformUserId: 'user-6',
                status: 'playing',
            },
            {
                reference: 7,
                username: 'gus',
                platform: 'discord',
                platformUserId: 'user-7',
                status: 'done',
            },
        ],
    })
})

test('clearq removes waiting participants while the queue is paused', async () => {
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
            {
                platformUserId: 'user-2',
                username: 'bea',
                status: 'notified',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
    })

    await clearQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Cleared 1 from the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [
            {
                reference: 2,
                username: 'bea',
                platform: 'discord',
                platformUserId: 'user-2',
                status: 'notified',
            },
        ],
    })
})

test('clearq on an empty waiting line replies that the queue is already empty', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'notified',
            },
            {
                platformUserId: 'user-2',
                username: 'bea',
                status: 'playing',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
    })

    await clearQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'The queue is already empty.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                reference: 1,
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'notified',
            },
            {
                reference: 2,
                username: 'bea',
                platform: 'discord',
                platformUserId: 'user-2',
                status: 'playing',
            },
        ],
    })
})
