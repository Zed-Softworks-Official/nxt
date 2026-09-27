import { api } from '@nxt/backend/api'
import { tryCatch } from '@nxt/utils'
import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

export const joinQ: Command = {
    data: new SlashCommandBuilder()
        .setName('joinq')
        .setDescription('Join the queue'),
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'player',
            run: async ({ guildId }) => {
                const { data, error } = await tryCatch(
                    convex.mutation(api.discord.joinQ, {
                        username: interaction.user.username,
                        platformUserId: interaction.user.id,
                        platformId: guildId,
                    })
                )

                if (error || data === 'already') {
                    await interaction.reply('Error joining the queue.')
                    return
                }

                if (data === 'paused') {
                    await interaction.reply('The queue is paused.')
                    return
                }

                await interaction.reply('Joined the queue.')
            },
        })
    },
}
