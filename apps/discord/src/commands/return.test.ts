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
import { returnQ } from './return'

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
            {
                platformUserId: 'tw-3',
                username: 'cy',
                status: 'playing',
                platform: 'twitch',
            },
            { platformUserId: 'user-4', username: 'dee', status: 'done' },
        ],
    })
    return backend
}

async function statuses(backend: Awaited<ReturnType<typeof seed>>) {
    const queue = await readQueue(backend, 'owner-1')
    return queue?.participants
        .filter((p) => p.status !== 'done')
        .map((p) => [p.reference, p.status])
}

function adminRuns(reference: string) {
    return fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { reference },
    })
}

test('returnq puts a Pinged Twitch Participant back in their spot in the queue', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('q-2')

    await returnQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'q-2 bea (Twitch) is back in the queue.', ephemeral: false },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'waiting'],
        [3, 'playing'],
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'returned_to_queue',
            username: 'bea',
            platform: 'twitch',
            platformUserId: 'tw-2',
        },
    ])
})

test('returnq is offered only to members with Manage Server', () => {
    expect(returnQ.data.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.ManageGuild.toString()
    )
})

test('returnq without Manage Server refuses and changes nothing', async () => {
    const backend = await seed()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        options: { reference: 'q-2' },
    })

    await returnQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You need Manage Server to do that.', ephemeral: false },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
        [3, 'playing'],
    ])
})

test('returnq with an ended reference says nobody holds it', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('q-4')

    await returnQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Nobody in the queue has the reference q-4.',
            ephemeral: false,
        },
    ])
})

test('returnq in the wrong state is refused and changes nothing', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('q-3')

    await returnQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content:
                'q-3 is playing. Only a Pinged Participant can return to the queue.',
            ephemeral: false,
        },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
        [3, 'playing'],
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})
