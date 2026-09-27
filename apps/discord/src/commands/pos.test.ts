import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readQueue,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { pos } from './pos'

test('a waiting participant sees their position and only they see it', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            {
                platformUserId: 'playing-1',
                username: 'pat',
                status: 'playing',
            },
            {
                platformUserId: 'wait-1',
                username: 'bea',
                status: 'waiting',
            },
            {
                platformUserId: 'ping-1',
                username: 'cy',
                status: 'notified',
            },
            {
                platformUserId: 'wait-2',
                username: 'dee',
                status: 'waiting',
            },
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'waiting',
            },
            {
                platformUserId: 'wait-3',
                username: 'eve',
                status: 'waiting',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        userId: 'user-1',
        username: 'ada',
    })

    await pos.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You are #3 in the queue.', ephemeral: true },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                username: 'pat',
                platform: 'discord',
                platformUserId: 'playing-1',
                status: 'playing',
            },
            {
                username: 'bea',
                platform: 'discord',
                platformUserId: 'wait-1',
                status: 'waiting',
            },
            {
                username: 'cy',
                platform: 'discord',
                platformUserId: 'ping-1',
                status: 'notified',
            },
            {
                username: 'dee',
                platform: 'discord',
                platformUserId: 'wait-2',
                status: 'waiting',
            },
            {
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
            {
                username: 'eve',
                platform: 'discord',
                platformUserId: 'wait-3',
                status: 'waiting',
            },
        ],
    })
})

test('a pinged participant sees that they have been pinged', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            {
                platformUserId: 'wait-1',
                username: 'bea',
                status: 'waiting',
            },
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'notified',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        userId: 'user-1',
        username: 'ada',
    })

    await pos.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You have been pinged.', ephemeral: true },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                username: 'bea',
                platform: 'discord',
                platformUserId: 'wait-1',
                status: 'waiting',
            },
            {
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'notified',
            },
        ],
    })
})

test('a playing participant sees that they are playing', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'playing',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        userId: 'user-1',
        username: 'ada',
    })

    await pos.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You are playing.', ephemeral: true },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'playing',
            },
        ],
    })
})

test('a member with no row in this community is not in the queue', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-a',
        guildId: 'guild-a',
        state: 'open',
        participants: [
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'waiting',
            },
        ],
    })
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-b',
        guildId: 'guild-b',
        state: 'open',
        participants: [
            {
                platformUserId: 'wait-1',
                username: 'bea',
                status: 'waiting',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-b',
        userId: 'user-1',
        username: 'ada',
    })

    await pos.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You are not in the queue.', ephemeral: true },
    ])
    expect(await readQueue(backend, 'owner-a')).toEqual({
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
    expect(await readQueue(backend, 'owner-b')).toEqual({
        state: 'open',
        participants: [
            {
                username: 'bea',
                platform: 'discord',
                platformUserId: 'wait-1',
                status: 'waiting',
            },
        ],
    })
})

test('position ignores waiting rows in another community', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-a',
        guildId: 'guild-a',
        state: 'open',
        participants: [
            {
                platformUserId: 'wait-1',
                username: 'bea',
                status: 'waiting',
            },
            {
                platformUserId: 'wait-2',
                username: 'cy',
                status: 'waiting',
            },
            {
                platformUserId: 'wait-3',
                username: 'dee',
                status: 'waiting',
            },
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'waiting',
            },
        ],
    })
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-b',
        guildId: 'guild-b',
        state: 'open',
        participants: [
            {
                platformUserId: 'wait-4',
                username: 'eve',
                status: 'waiting',
            },
            {
                platformUserId: 'user-1',
                username: 'ada',
                status: 'waiting',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-b',
        userId: 'user-1',
        username: 'ada',
    })

    await pos.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You are #2 in the queue.', ephemeral: true },
    ])
    expect(await readQueue(backend, 'owner-a')).toEqual({
        state: 'open',
        participants: [
            {
                username: 'bea',
                platform: 'discord',
                platformUserId: 'wait-1',
                status: 'waiting',
            },
            {
                username: 'cy',
                platform: 'discord',
                platformUserId: 'wait-2',
                status: 'waiting',
            },
            {
                username: 'dee',
                platform: 'discord',
                platformUserId: 'wait-3',
                status: 'waiting',
            },
            {
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
        ],
    })
    expect(await readQueue(backend, 'owner-b')).toEqual({
        state: 'open',
        participants: [
            {
                username: 'eve',
                platform: 'discord',
                platformUserId: 'wait-4',
                status: 'waiting',
            },
            {
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
        ],
    })
})

test('a waiting participant still sees their position while the queue is paused', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'paused',
        participants: [
            {
                platformUserId: 'wait-1',
                username: 'bea',
                status: 'waiting',
            },
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
        username: 'ada',
    })

    await pos.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You are #2 in the queue.', ephemeral: true },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [
            {
                username: 'bea',
                platform: 'discord',
                platformUserId: 'wait-1',
                status: 'waiting',
            },
            {
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'waiting',
            },
        ],
    })
})
