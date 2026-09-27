import { api } from '@nxt/backend/api'
import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { editDeferred, runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

type PositionResult =
    | { outcome: 'waiting'; position: number }
    | { outcome: 'pinged' }
    | { outcome: 'playing' }
    | { outcome: 'absent' }

export const pos: Command = {
    data: new SlashCommandBuilder()
        .setName('pos')
        .setDescription('Check your position in the queue'),
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'player',
            ephemeral: true,
            run: async ({ communityId }) => {
                const result = await convex.query(api.position.getPosition, {
                    communityId,
                    platformUserId: interaction.user.id,
                })
                await editDeferred(interaction, {
                    content: positionReply(result),
                    ephemeral: true,
                })
            },
        })
    },
}

function positionReply(result: PositionResult): string {
    switch (result.outcome) {
        case 'waiting':
            return `You are #${result.position} in the queue.`
        case 'pinged':
            return 'You have been pinged.'
        case 'playing':
            return 'You are playing.'
        case 'absent':
            return 'You are not in the queue.'
    }
}
