import { internal } from '@nxt/backend/api'
import type { CommandInteraction } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

export const clearQ: Command = {
    data: new SlashCommandBuilder()
        .setName('clearq')
        .setDescription('Clear the waiting line')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'admin',
            run: async ({ communityId }) => {
                const cleared = await convex.mutation(
                    internal.clearQueue.clearWaiting,
                    { communityId }
                )
                if (cleared === 0) {
                    await interaction.reply('The queue is already empty.')
                    return
                }
                await interaction.reply(`Cleared ${cleared} from the queue.`)
            },
        })
    },
}
