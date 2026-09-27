import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readQueue,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { joinQ } from './join'

const waiting = {
    username: 'ada',
    platform: 'discord' as const,
    platformUserId: 'user-1',
    status: 'waiting' as const,
}

test('joinq in a direct message replies that it can only be used in a server', async () => {
    const backend = createTestBackend()
    const { interaction, replies } = fakeInteraction({ guildId: null })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'This command can only be used in a server.',
            ephemeral: false,
        },
    ])
})

test('joinq in an unlinked server replies that the server is not connected', async () => {
    const backend = createTestBackend()
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: "This server isn't connected to a community.",
            ephemeral: false,
        },
    ])
})

test('joinq while the queue is open adds a waiting participant in the channel', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: 'anywhere',
        userId: 'user-1',
        username: 'ada',
    })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Joined the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [waiting],
    })
})

test('joinq while the queue is paused replies and adds nobody', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'paused',
    })
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'The queue is paused.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [],
    })
})

test('a second joinq while waiting replies with the generic join error', async () => {
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
        username: 'ada',
    })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Error joining the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [waiting],
    })
})

test('a second joinq while pinged replies with the generic join error', async () => {
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

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Error joining the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [
            {
                username: 'ada',
                platform: 'discord',
                platformUserId: 'user-1',
                status: 'notified',
            },
        ],
    })
})

test('a second joinq while playing replies with the generic join error', async () => {
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

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Error joining the queue.', ephemeral: false },
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

test('joinq still adds someone who is already waiting in another community', async () => {
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
        username: 'ada',
    })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Joined the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-a')).toEqual({
        state: 'open',
        participants: [waiting],
    })
    expect(await readQueue(backend, 'owner-b')).toEqual({
        state: 'open',
        participants: [waiting],
    })
})

test('joinq works in any channel when no command channel is set', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: 'random-channel',
        userId: 'user-1',
        username: 'ada',
    })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Joined the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [waiting],
    })
})

test('joinq in the command channel adds a waiting participant', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        commandChannelId: '111',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: '111',
        userId: 'user-1',
        username: 'ada',
    })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Joined the queue.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [waiting],
    })
})

test('joinq in the wrong channel is only visible to the invoker and adds nobody', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        commandChannelId: '111',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: '222',
        userId: 'user-1',
        username: 'ada',
    })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Queue commands go in <#111>.',
            ephemeral: true,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('joinq in the wrong channel does not create a missing queue', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'none',
        commandChannelId: '111',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: '222',
    })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Queue commands go in <#111>.',
            ephemeral: true,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: null,
        participants: [],
    })
})

test('joinq on a community with no queue creates it paused and does not open it', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'none',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        userId: 'user-1',
        username: 'ada',
    })

    await joinQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'The queue is paused.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [],
    })
})
