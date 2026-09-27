import { api } from '@nxt/backend/api'
import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { editDeferred, runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

const DISCORD_MESSAGE_LIMIT = 2000

function formatWaitingLine(state: 'open' | 'paused', usernames: string[]) {
    const stateLine =
        state === 'open' ? 'The queue is open.' : 'The queue is paused.'
    if (usernames.length === 0) {
        return `${stateLine}\nNobody is waiting.`
    }

    const lines = usernames.map(
        (username, index) => `${index + 1}. ${username}`
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
            run: async ({ communityId }) => {
                const line = await convex.query(api.viewQueue.viewQueue, {
                    communityId,
                })
                await editDeferred(
                    interaction,
                    formatWaitingLine(line.state, line.usernames)
                )
            },
        })
    },
}
