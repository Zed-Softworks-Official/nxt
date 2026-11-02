import { internal } from '@nxt/backend/api'
import type { CommandInteraction } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { describeParticipant } from '@nxt/backend/participant'
import { editDeferred, NOT_CONNECTED, runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

const MAX_COUNT = 25

const data = new SlashCommandBuilder()
    .setName('pingq')
    .setDescription('Call the next Participants in the queue')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

data.addIntegerOption((option) =>
    option
        .setName('count')
        .setDescription('How many to call from the front (default 1)')
        .setMinValue(1)
        .setMaxValue(MAX_COUNT)
        .setRequired(false)
)

export const pingQ: Command = {
    data,
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'admin',
            run: async ({ link }) => {
                const result = await convex.mutation(
                    internal.platformQueue.ping,
                    { link, count: requestedCount(interaction) }
                )
                if (result.kind === 'unlinked') {
                    await editDeferred(interaction, NOT_CONNECTED)
                    return
                }
                if (result.kind === 'empty') {
                    await editDeferred(
                        interaction,
                        'Nobody is waiting in the queue.'
                    )
                    return
                }
                await editDeferred(
                    interaction,
                    `Pinged ${result.pinged.map(describeParticipant).join(', ')}.`
                )
            },
        })
    },
}

function requestedCount(interaction: CommandInteraction): number {
    if (!interaction.isChatInputCommand()) return 1
    return interaction.options.getInteger('count') ?? 1
}
