import { api } from '@nxt/backend/api'
import type { CommandInteraction } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

export const endQ: Command = {
    data: new SlashCommandBuilder()
        .setName('endq')
        .setDescription('Pause the queue')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'admin',
            run: async ({ communityId }) => {
                const result = await convex.mutation(
                    api.queueState.pauseQueue,
                    {
                        communityId,
                    }
                )

                if (result === 'already') {
                    await interaction.reply('The queue is already paused.')
                    return
                }

                await interaction.reply('The queue is paused.')
            },
        })
    },
}
