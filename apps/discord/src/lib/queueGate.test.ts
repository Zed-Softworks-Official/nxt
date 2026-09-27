import type { CommandInteraction } from 'discord.js'
import { expect, test } from 'vitest'
import type { QueueConvex } from '~/lib/convex'
import { editDeferred, runQueueCommand } from '~/lib/queueGate'
import { fakeInteraction } from '../test/queueHarness'

function spyDefer(
    interaction: CommandInteraction,
    onDefer: (ephemeral: boolean) => void
) {
    const raw = interaction as unknown as {
        deferReply: (options?: { ephemeral?: boolean }) => Promise<void>
    }
    const deferReply = raw.deferReply.bind(raw)
    raw.deferReply = async (options) => {
        onDefer(options?.ephemeral === true)
        await deferReply(options)
    }
}

test('defers before the community lookup and edits that reply', async () => {
    const events: string[] = []
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })
    spyDefer(interaction, () => {
        events.push('defer')
    })

    const client = {
        query: async () => {
            events.push('query')
            return null
        },
        mutation: async () => {
            events.push('mutation')
        },
    } as unknown as QueueConvex

    await runQueueCommand(interaction, client, {
        kind: 'player',
        run: async () => {
            events.push('run')
        },
    })

    expect(events).toEqual(['defer', 'query'])
    expect(replies).toEqual([
        {
            content: "This server isn't connected to a community.",
            ephemeral: false,
        },
    ])
})

test('defers a private player command before Convex work', async () => {
    const events: string[] = []
    const { interaction, replies } = fakeInteraction({ guildId: 'guild-1' })
    spyDefer(interaction, (ephemeral) => {
        events.push(ephemeral ? 'defer-private' : 'defer')
    })

    const client = {
        query: async () => {
            events.push('query')
            return { communityId: 'community-1', commandChannelId: null }
        },
        mutation: async () => {
            events.push('mutation')
        },
    } as unknown as QueueConvex

    await runQueueCommand(interaction, client, {
        kind: 'player',
        ephemeral: true,
        run: async () => {
            events.push('run')
            await editDeferred(interaction, {
                content: 'You are #1 in the queue.',
                ephemeral: true,
            })
        },
    })

    expect(events).toEqual(['defer-private', 'query', 'mutation', 'run'])
    expect(replies).toEqual([
        { content: 'You are #1 in the queue.', ephemeral: true },
    ])
})

test('a public defer still answers the wrong channel privately', async () => {
    const events: string[] = []
    const { interaction, replies } = fakeInteraction({
        guildId: 'guild-1',
        channelId: '222',
    })
    spyDefer(interaction, () => {
        events.push('defer')
    })
    const client = {
        query: async () => {
            events.push('query')
            return { communityId: 'community-1', commandChannelId: '111' }
        },
        mutation: async () => {
            events.push('mutation')
        },
    } as unknown as QueueConvex

    await runQueueCommand(interaction, client, {
        kind: 'player',
        run: async () => {
            events.push('run')
        },
    })

    expect(events).toEqual(['defer', 'query'])
    expect(replies).toEqual([
        {
            content: 'Queue commands go in <#111>.',
            ephemeral: true,
        },
    ])
})
