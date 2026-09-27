import { PermissionFlagsBits } from 'discord.js'
import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readQueue,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { startQ } from './start'

const waiting = {
    username: 'ada',
    platform: 'discord' as const,
    platformUserId: 'user-1',
    status: 'waiting' as const,
}

test('startq is hidden from members without Manage Server', () => {
    expect(startQ.data.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.ManageGuild.toString()
    )
})

test('startq in a direct message replies that it can only be used in a server', async () => {
    const backend = createTestBackend()
    const { interaction, replies } = fakeInteraction({
        guildId: null,
        manageServer: true,
    })

    await startQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'This command can only be used in a server.',
            ephemeral: false,
        },
    ])
})

test('startq in an unlinked server replies that the server is not connected', async () => {
    const backend = createTestBackend()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
    })

    await startQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: "This server isn't connected to a community.",
            ephemeral: false,
        },
    ])
})

test('startq without Manage Server is refused and leaves the queue paused', async () => {
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

    await startQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'You need Manage Server to do that.',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [waiting],
    })
})

test('startq opens a paused queue in the channel where it was run', async () => {
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
        channelId: 'anywhere',
        manageServer: true,
    })

    await startQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'The queue is open.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [waiting],
    })
})

test('startq on an open queue replies that it is already open and changes nothing', async () => {
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
        manageServer: true,
    })

    await startQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'The queue is already open.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [waiting],
    })
})

test('startq opens the queue from a channel other than the command channel', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'paused',
        commandChannelId: '111',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: '222',
        manageServer: true,
    })

    await startQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'The queue is open.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})

test('startq on a community with no queue opens the paused queue ensure created', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'none',
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
    })

    await startQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'The queue is open.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [],
    })
})
