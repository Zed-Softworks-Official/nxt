import { internal } from '@nxt/backend/api'
import { PermissionFlagsBits } from 'discord.js'
import { expect, test } from 'vitest'
import {
    asQueueConvex,
    createTestBackend,
    fakeInteraction,
    readActivityLog,
    seedDiscordCommunity,
} from '../test/queueHarness'
import { moveQ } from './move'

async function seed() {
    const backend = createTestBackend()
    await seedDiscordCommunity(backend, {
        ownerId: 'owner-1',
        guildId: 'guild-1',
        state: 'open',
        participants: [
            { platformUserId: 'user-1', username: 'ada', status: 'waiting' },
            { platformUserId: 'user-2', username: 'bea', status: 'waiting' },
            { platformUserId: 'user-3', username: 'cy', status: 'playing' },
            {
                platformUserId: 'tw-4',
                username: 'dee',
                status: 'waiting',
                platform: 'twitch',
            },
            { platformUserId: 'user-5', username: 'eve', status: 'done' },
        ],
    })
    return backend
}

async function waitingOrder(backend: Awaited<ReturnType<typeof seed>>) {
    const view = await backend.query(internal.platformQueue.view, {
        link: { platform: 'discord', platformId: 'guild-1' },
    })
    return view.kind === 'ok' ? view.waiting.map((p) => p.reference) : null
}

function adminRuns(options: Record<string, string | number>) {
    return fakeInteraction({ guildId: 'guild-1', manageServer: true, options })
}

test('moveq moves a waiting Twitch Participant to a Position', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns({
        reference: 'q-4',
        position: 1,
    })

    await moveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Moved q-4 dee (Twitch) to Position 1.',
            ephemeral: false,
        },
    ])
    expect(await waitingOrder(backend)).toEqual([4, 1, 2])
    expect(await readActivityLog(backend, 'owner-1')).toEqual([])
})

test('moveq to a Position past the end moves them to the back', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns({
        reference: 'q-1',
        position: 50,
    })

    await moveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'Moved q-1 ada (Discord) to Position 3.', ephemeral: false },
    ])
    expect(await waitingOrder(backend)).toEqual([2, 4, 1])
})

test('moveq is offered only to members with Manage Server', () => {
    expect(moveQ.data.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.ManageGuild.toString()
    )
})

test('moveq without Manage Server refuses and changes nothing', async () => {
    const backend = await seed()
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        options: { reference: 'q-4', position: 1 },
    })

    await moveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        { content: 'You need Manage Server to do that.', ephemeral: false },
    ])
    expect(await waitingOrder(backend)).toEqual([1, 2, 4])
})

test('moveq with an ended reference says nobody holds it', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns({
        reference: 'q-5',
        position: 1,
    })

    await moveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'Nobody in the queue has the reference q-5.',
            ephemeral: false,
        },
    ])
})

test('moveq of a Playing Participant is refused and changes nothing', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns({
        reference: 'q-3',
        position: 1,
    })

    await moveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: 'q-3 is playing. Only a waiting Participant can be moved.',
            ephemeral: false,
        },
    ])
    expect(await waitingOrder(backend)).toEqual([1, 2, 4])
})

test('moveq with text that is not a reference says how to write one', async () => {
    const backend = await seed()
    const { interaction, replies } = adminRuns({
        reference: 'dee',
        position: 1,
    })

    await moveQ.execute(interaction, asQueueConvex(backend))

    expect(replies).toEqual([
        {
            content: '"dee" is not a Participant reference. Use one like q-42.',
            ephemeral: false,
        },
    ])
})

test('moveq asks for a Position of at least 1', () => {
    const position = moveQ.data
        .toJSON()
        .options?.find((option) => option.name === 'position')
    expect(position).toMatchObject({ required: true, min_value: 1 })
})
