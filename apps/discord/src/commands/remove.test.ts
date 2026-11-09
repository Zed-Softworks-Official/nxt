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
import { removeQ } from './remove'

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
                status: 'waiting',
                platform: 'twitch',
            },
            { platformUserId: 'user-3', username: 'cy', status: 'playing' },
            { platformUserId: 'user-4', username: 'dee', status: 'done' },
        ],
    })
    return backend
}

async function references(backend: Awaited<ReturnType<typeof seed>>) {
    const queue = await readQueue(backend, 'owner-1')
    return queue?.participants
        .filter((p) => p.status !== 'done')
        .map((p) => p.reference)
}

function adminRuns(reference: string) {
    return fakeInteraction({
        guildId: 'guild-1',
        manageServer: true,
        options: { reference },
    })
}

test('removeq ends a waiting Twitch Participant entry silently', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('q-2')

    await removeQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Removed q-2 bea (Twitch).', ephemeral: false },
    ])
    expect(await references(backend)).toEqual([1, 3])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('removeq ends a Playing Participant entry too', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('q-3')

    await removeQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Removed q-3 cy (Discord).', ephemeral: false },
    ])
    expect(await references(backend)).toEqual([1, 2])
})

test('removeq of a Pinged Participant drops their pending Announcement', async () => {
    const backend = await seed()
    await backend.mutation(internal.platformQueue.pingOne, {
        link: { platform: 'discord', platformId: 'guild-1' },
        reference: 1,
    })
    const { interaction, replies } = adminRuns('q-1')

    await removeQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Removed q-1 ada (Discord).', ephemeral: false },
    ])
    expect(
        await backend.query(internal.announcements.pending, {
            platform: 'discord',
        })
    ).toEqual([])
})

test('removeq is offered only to members with Manage Server', () => {
    expect(removeQ.data.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.ManageGuild.toString()
    )
})

test('removeq without Manage Server refuses and changes nothing', async () => {
    const backend = await seed()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        options: { reference: 'q-2' },
    })

    await removeQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You need Manage Server to do that.', ephemeral: false },
    ])
    expect(await references(backend)).toEqual([1, 2, 3])
})

test('removeq with an ended reference says nobody holds it', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('q-4')

    await removeQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Nobody in the queue has the reference q-4.',
            ephemeral: false,
        },
    ])
    expect(await references(backend)).toEqual([1, 2, 3])
})

test('removeq with text that is not a reference says how to write one', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns('bea')

    await removeQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: '"bea" is not a Participant reference. Use one like q-42.',
            ephemeral: false,
        },
    ])
})
