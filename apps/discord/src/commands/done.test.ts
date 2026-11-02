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
import { doneQ } from './done'

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

test('doneq finishes the turn of a Playing Twitch Participant and ends their entry', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('q-3')

    await doneQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'q-3 cy (Twitch) is done.', ephemeral: false },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
    ])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([
        {
            event: 'finished',
            username: 'cy',
            platform: 'twitch',
            platformUserId: 'tw-3',
        },
    ])
})

test('doneq is offered only to members with Manage Server', () => {
    expect(doneQ.data.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.ManageGuild.toString()
    )
})

test('doneq without Manage Server refuses and changes nothing', async () => {
    const backend = await seed()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        options: { reference: 'q-3' },
    })

    await doneQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You need Manage Server to do that.', ephemeral: false },
    ])
    expect(await statuses(backend)).toEqual([
        [1, 'waiting'],
        [2, 'notified'],
        [3, 'playing'],
    ])
})

test('doneq with an ended reference says nobody holds it', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('q-4')

    await doneQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Nobody in the queue has the reference q-4.',
            ephemeral: false,
        },
    ])
})

test('doneq in the wrong state is refused and changes nothing', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('q-2')

    await doneQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'q-2 is Pinged. Only a Playing Participant can finish.',
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
