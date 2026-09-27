import { PermissionFlagsBits } from 'discord.js'
import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readQueue,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { endQ } from './end'

const waiting = {
    username: 'ada',
    platform: 'discord' as const,
    platformUserId: 'user-1',
    status: 'waiting' as const,
}

const pinged = {
    username: 'bea',
    platform: 'discord' as const,
    platformUserId: 'user-2',
    status: 'notified' as const,
}

const playing = {
    username: 'cy',
    platform: 'discord' as const,
    platformUserId: 'user-3',
    status: 'playing' as const,
}

test('endq is hidden from members without Manage Server', () => {
    expect(endQ.data.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.ManageGuild.toString()
    )
})

test('endq in a direct message replies that it can only be used in a server', async () => {
    const backend = createTestBackend()
    const { interaction, replies } = fakeInteraction({
        guildId: null,
        manageServer: true,
    })

    await endQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'This command can only be used in a server.',
            ephemeral: false,
        },
    ])
})

test('endq in an unlinked server replies that the server is not connected', async () => {
    const backend = createTestBackend()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
    })

    await endQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: "This server isn't connected to a community.",
            ephemeral: false,
        },
    ])
})

test('endq without Manage Server is refused and leaves the queue open', async () => {
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
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await endQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'You need Manage Server to do that.',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'open',
        participants: [waiting],
    })
})

test('endq pauses an open queue and leaves every participant in place', async () => {
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
                username: 'bea',
                status: 'notified',
            },
            {
                platformUserId: 'user-3',
                username: 'cy',
                status: 'playing',
            },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: 'anywhere',
        manageServer: true,
    })

    await endQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'The queue is paused.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [waiting, pinged, playing],
    })
})

test('endq on a paused queue replies that it is already paused and changes nothing', async () => {
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
        manageServer: true,
    })

    await endQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'The queue is already paused.',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [waiting],
    })
})

test('endq pauses the queue from a channel other than the command channel', async () => {
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
        manageServer: true,
    })

    await endQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'The queue is paused.', ephemeral: false },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [],
    })
})

test('endq on a community with no queue reports that it is already paused', async () => {
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

    await endQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'The queue is already paused.',
            ephemeral: false,
        },
    ])
    expect(await readQueue(backend, 'owner-1')).toEqual({
        state: 'paused',
        participants: [],
    })
})
