import { internal } from '@nxt/backend/api'
import { tryCatch } from '@nxt/utils'
import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { editDeferred, runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

export const joinQ: Command = {
    data: new SlashCommandBuilder()
        .setName('joinq')
        .setDescription('Join the queue'),
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'player',
            run: async ({ link }) => {
                const { data, error } = await tryCatch(
                    convex.mutation(internal.platformQueue.join, {
                        link,
                        username: interaction.user.username,
                        platformUserId: interaction.user.id,
                        ...(interaction.channelId
                            ? { channelId: interaction.channelId }
                            : {}),
                    })
                )

                if (
                    error ||
                    data.kind === 'already' ||
                    data.kind === 'unlinked'
                ) {
                    await editDeferred(interaction, 'Error joining the queue.')
                    return
                }

                if (data.kind === 'paused') {
                    await editDeferred(interaction, 'The queue is paused.')
                    return
                }

                await editDeferred(interaction, 'Joined the queue.')
            },
        })
    },
}
