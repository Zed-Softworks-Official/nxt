import { internal } from '@nxt/backend/api'
import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { describeParticipant, type Platform } from '~/lib/participant'
import { editDeferred, NOT_CONNECTED, runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

const DISCORD_MESSAGE_LIMIT = 2000

type WaitingEntry = {
    reference: number
    username: string
    platform: Platform
}

function formatWaitingLine(state: 'open' | 'paused', waiting: WaitingEntry[]) {
    const stateLine =
        state === 'open' ? 'The queue is open.' : 'The queue is paused.'
    if (waiting.length === 0) {
        return `${stateLine}\nNobody is waiting.`
    }

    const lines = waiting.map(
        (entry, index) => `${index + 1}. ${describeParticipant(entry)}`
    )
    const full = [stateLine, ...lines].join('\n')
    if (full.length <= DISCORD_MESSAGE_LIMIT) return full

    for (let count = lines.length - 1; count >= 0; count--) {
        const hidden = lines.length - count
        const message = [
            stateLine,
            ...lines.slice(0, count),
            `…and ${hidden} more.`,
        ].join('\n')
        if (message.length <= DISCORD_MESSAGE_LIMIT) return message
    }

    return `${stateLine}\n…and ${lines.length} more.`
}

export const viewQ: Command = {
    data: new SlashCommandBuilder()
        .setName('viewq')
        .setDescription('View the queue'),
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'player',
            run: async ({ link }) => {
                const view = await convex.query(internal.platformQueue.view, {
                    link,
                })
                if (view.kind === 'unlinked') {
                    await editDeferred(interaction, NOT_CONNECTED)
                    return
                }
                await editDeferred(
                    interaction,
                    formatWaitingLine(view.state, view.waiting)
                )
            },
        })
    },
}
