import type { FunctionReturnType } from '@nxt/backend'
import { internal } from '@nxt/backend/api'
import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { editDeferred, runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

type PositionResult = FunctionReturnType<typeof internal.platformQueue.position>

export const pos: Command = {
    data: new SlashCommandBuilder()
        .setName('pos')
        .setDescription('Check your position in the queue'),
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'player',
            ephemeral: true,
            run: async ({ link }) => {
                const result = await convex.query(
                    internal.platformQueue.position,
                    {
                        link,
                        platformUserId: interaction.user.id,
                    }
                )
                await editDeferred(interaction, {
                    content: positionReply(result),
                    ephemeral: true,
                })
            },
        })
    },
}

function positionReply(result: PositionResult): string {
    switch (result.kind) {
        case 'waiting':
            return `You are #${result.position} in the queue.`
        case 'pinged':
            return 'You have been pinged.'
        case 'playing':
            return 'You are playing.'
        case 'absent':
        case 'unlinked':
            return 'You are not in the queue.'
    }
}
