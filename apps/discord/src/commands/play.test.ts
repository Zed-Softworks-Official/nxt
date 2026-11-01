import { PermissionFlagsBits } from 'discord.js'
import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readQueue,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { playQ } from './play'

async function seed() {
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
                status: 'notified',
                platform: 'twitch',
            },
            { platformUserId: 'user-3', username: 'cy', status: 'playing' },
        ],
    })
    return backend
}

async function statuses(backend: Awaited<ReturnType<typeof seed>>) {
    const queue = await readQueue(backend, 'owner-1')
    return queue?.participants.map((p) => [p.reference, p.status])
}

test('playq moves a Pinged Twitch Participant to Playing by reference', async () => {
    const backend = await seed()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { reference: 'q-2' },
    })

    await playQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'q-2 bea (Twitch) is now playing.', ephemeral: false },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'playing'],
        [3, 'playing'],
    ])
})

test('playq is offered only to members with Manage Server', () => {
    expect(playQ.data.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.ManageGuild.toString()
    )
})

test('playq without Manage Server refuses and changes nothing', async () => {
    const backend = await seed()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        options: { reference: 'q-2' },
    })

    await playQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You need Manage Server to do that.', ephemeral: false },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
        [3, 'playing'],
    ])
})

test('playq with a reference nobody holds says so', async () => {
    const backend = await seed()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { reference: 'q-9' },
    })

    await playQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Nobody in the queue has the reference q-9.',
            ephemeral: false,
        },
    ])
})

test('playq with something that is not a reference explains the format', async () => {
    const backend = await seed()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { reference: 'bea' },
    })

    await playQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: '"bea" is not a Participant reference. Use one like q-42.',
            ephemeral: false,
        },
    ])
})

test('playq on a Participant who is not Pinged is refused', async () => {
    const backend = await seed()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { reference: 'q-3' },
    })

    await playQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content:
                'q-3 is playing. Only a Pinged Participant can start playing.',
            ephemeral: false,
        },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
        [3, 'playing'],
    ])
})
