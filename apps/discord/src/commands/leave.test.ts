import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readQueue,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { leaveQ } from './leave'

test('leaveq in a direct message replies that it can only be used in a server', async () => {
    const backend = createTestBackend()
    const { interaction, replies } = fakeInteraction({ guildId: null })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'This command can only be used in a server.',
            ephemeral: false,
        },
    ])
})

test('leaveq in an unlinked server replies that the server is not connected', async () => {
    const backend = createTestBackend()
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: "This server isn't connected to a community.",
            ephemeral: false,
        },
    ])
})

test('leaveq removes a waiting participant and replies in the channel', async () => {
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
        channelId: 'anywhere',
        userId: 'user-1',
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([{ content: 'Left the queue.', ephemeral: false }])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('leaveq removes a pinged participant', async () => {
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
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        userId: 'user-1',
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([{ content: 'Left the queue.', ephemeral: false }])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('leaveq removes a playing participant', async () => {
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
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([{ content: 'Left the queue.', ephemeral: false }])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('leaveq removes a waiting participant while the queue is paused', async () => {
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
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        userId: 'user-1',
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([{ content: 'Left the queue.', ephemeral: false }])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [],
    })
})

test('leaveq when this community has no row replies with the generic leave error', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        userId: 'user-1',
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Error leaving the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('leaveq does not remove a participant who is only in another community', async () => {
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
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-b',
        userId: 'user-1',
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Error leaving the queue.', ephemeral: false },
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
        participants: [],
    })
})

test('leaveq works in any channel when no command channel is set', async () => {
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
        channelId: 'random-channel',
        userId: 'user-1',
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([{ content: 'Left the queue.', ephemeral: false }])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('leaveq in the command channel removes the participant', async () => {
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
        channelId: '111',
        userId: 'user-1',
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([{ content: 'Left the queue.', ephemeral: false }])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('leaveq in the wrong channel is only visible to the invoker and removes nobody', async () => {
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
        userId: 'user-1',
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

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

test('leaveq on a community with no queue creates it paused and reports the generic error', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'none',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        userId: 'user-1',
    })

    await leaveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Error leaving the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [],
    })
})
