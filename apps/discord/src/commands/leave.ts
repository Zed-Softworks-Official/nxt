import { internal } from '@nxt/backend/api'
import { tryCatch } from '@nxt/utils'
import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { editDeferred, runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

export const leaveQ: Command = {
    data: new SlashCommandBuilder()
        .setName('leaveq')
        .setDescription('Leave the queue'),
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'player',
            run: async ({ link }) => {
                const { data, error } = await tryCatch(
                    convex.mutation(internal.platformQueue.leave, {
                        link,
                        platformUserId: interaction.user.id,
                    })
                )

                if (error || data.kind !== 'ok') {
                    await editDeferred(interaction, 'Error leaving the queue.')
                    return
                }

                await editDeferred(interaction, 'Left the queue.')
            },
        })
    },
}
