import { internal } from '@nxt/backend/api'
import type { CommandInteraction } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { editDeferred, NOT_CONNECTED, runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

export const startQ: Command = {
    data: new SlashCommandBuilder()
        .setName('startq')
        .setDescription('Open the queue')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'admin',
            run: async ({ link }) => {
                const result = await convex.mutation(
                    internal.platformQueue.open,
                    { link }
                )

                if (result.kind === 'unlinked') {
                    await editDeferred(interaction, NOT_CONNECTED)
                    return
                }

                if (result.kind === 'already') {
                    await editDeferred(
                        interaction,
                        'The queue is already open.'
                    )
                    return
                }

                await editDeferred(interaction, 'The queue is open.')
            },
        })
    },
}
