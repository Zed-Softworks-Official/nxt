import { PermissionFlagsBits } from 'discord.js'
import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readActivityLog,
    readQueue,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { pingQ } from './ping'

test('pingq calls the Participant at the front of the queue', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            { platformUserId: 'user-1', username: 'ada', status: 'waiting' },
            { platformUserId: 'user-2', username: 'bea', status: 'waiting' },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Pinged q-1 ada (Discord).', ephemeral: false },
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
                status: 'waiting',
            },
        ],
    })
    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'pinged',
            username: 'ada',
            platform: 'discord',
            platformUserId: 'user-1',
        },
    ])
})

test('pingq with a count calls that many from the front, on any platform', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            { platformUserId: 'user-1', username: 'ada', status: 'waiting' },
            {
                platformUserId: 'tw-2',
                username: 'bea',
                status: 'waiting',
                platform: 'twitch',
            },
            { platformUserId: 'user-3', username: 'cy', status: 'notified' },
            { platformUserId: 'user-4', username: 'dee', status: 'waiting' },
            { platformUserId: 'user-5', username: 'eve', status: 'waiting' },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { count: 3 },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content:
                'Pinged q-1 ada (Discord), q-2 bea (Twitch), q-4 dee (Discord).',
            ephemeral: false,
        },
    ])
    const queue = await readQueue(backend, 'owner-1')
    expect(queue?.participants.map((p) => [p.reference, p.status])).toEqual([
        [1, 'notified'],
        [2, 'notified'],
        [3, 'notified'],
        [4, 'notified'],
        [5, 'waiting'],
    ])
})

test('pingq is offered only to members with Manage Server', () => {
    expect(pingQ.data.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.ManageGuild.toString()
    )
})

test('pingq without Manage Server refuses and calls nobody', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            { platformUserId: 'user-1', username: 'ada', status: 'waiting' },
        ],
    })
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You need Manage Server to do that.', ephemeral: false },
    ])
    const queue = await readQueue(backend, 'owner-1')
    expect(queue?.participants.map((p) => p.status)).toEqual(['waiting'])
})

test('pingq on an empty queue replies that nobody is waiting', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            { platformUserId: 'user-1', username: 'ada', status: 'playing' },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Nobody is waiting in the queue.', ephemeral: false },
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})
