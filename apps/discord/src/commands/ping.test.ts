import { internal } from '@nxt/backend/api'
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

test('pingq with a note carries it on the Announcement', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        commandChannelId: 'commands',
        participants: [
            { platformUserId: 'user-1', username: 'ada', status: 'waiting' },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { note: 'VC 2' },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Pinged q-1 ada (Discord).', ephemeral: false },
    ])
    const [announcement] = await backend.query(internal.announcements.pending, {
        platform: 'discord',
    })
    expect(announcement).toMatchObject({ note: 'VC 2' })
})

test('pingq with an over-limit note says so and calls nobody', async () => {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            { platformUserId: 'user-1', username: 'ada', status: 'waiting' },
        ],
    })
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { note: 'x'.repeat(201) },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'That note is too long. Keep it to 200 characters.',
            ephemeral: false,
        },
    ])
    const queue = await readQueue(backend, 'owner-1')
    expect(queue?.participants[0]?.status).toBe('waiting')
})

async function seedForTargetedPing() {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        commandChannelId: 'commands',
        participants: [
            {
                platformUserId: 'tw-1',
                username: 'ada',
                status: 'waiting',
                platform: 'twitch',
            },
            { platformUserId: 'user-2', username: 'bea', status: 'waiting' },
            { platformUserId: 'user-3', username: 'cy', status: 'playing' },
            { platformUserId: 'user-4', username: 'dee', status: 'done' },
        ],
    })
    return backend
}

async function statuses(backend: ReturnType<typeof createTestBackend>) {
    const queue = await readQueue(backend, 'owner-1')
    return queue?.participants
        .filter((p) => p.status !== 'done')
        .map((p) => [p.reference, p.status])
}

test('pingq with a participant calls that one Participant, out of order', async () => {
    const backend = await seedForTargetedPing()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { participant: 'q-2', note: 'VC 2' },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Pinged q-2 bea (Discord).', ephemeral: false },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
        [3, 'playing'],
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'pinged',
            username: 'bea',
            platform: 'discord',
            platformUserId: 'user-2',
        },
    ])
    const [announcement] = await backend.query(internal.announcements.pending, {
        platform: 'discord',
    })
    expect(announcement).toMatchObject({ note: 'VC 2' })
})

test('pingq with both a count and a participant is refused and calls nobody', async () => {
    const backend = await seedForTargetedPing()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { participant: 'q-2', count: 2 },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Give either a count or a participant, not both.',
            ephemeral: false,
        },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'waiting'],
        [3, 'playing'],
    ])
})

test('pingq with an ended participant says nobody holds the reference', async () => {
    const backend = await seedForTargetedPing()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { participant: 'q-4' },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Nobody in the queue has the reference q-4.',
            ephemeral: false,
        },
    ])
})

test('pingq with a participant who is not waiting is refused', async () => {
    const backend = await seedForTargetedPing()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { participant: 'q-3' },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content:
                'q-3 is playing. Only a waiting Participant can be Pinged.',
            ephemeral: false,
        },
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('pingq with a participant that is not a reference says how to write one', async () => {
    const backend = await seedForTargetedPing()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { participant: 'bea' },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: '"bea" is not a Participant reference. Use one like q-42.',
            ephemeral: false,
        },
    ])
})

test('pingq with a participant and an over-limit note says so and calls nobody', async () => {
    const backend = await seedForTargetedPing()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { participant: 'q-2', note: 'x'.repeat(201) },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'That note is too long. Keep it to 200 characters.',
            ephemeral: false,
        },
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('pingq with a participant and no Manage Server refuses', async () => {
    const backend = await seedForTargetedPing()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        options: { participant: 'q-2' },
    })

    await pingQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You need Manage Server to do that.', ephemeral: false },
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})
