import { internal } from '@nxt/backend/api'
import { describeParticipant } from '@nxt/backend/participant'
import { PING_NOTE_MAX_LENGTH } from '@nxt/backend/pingNote'
import type { CommandInteraction } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { getConvex, type QueueConvex } from '~/lib/convex'
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

data.addStringOption((option) =>
    option
        .setName('note')
        .setDescription(
            'Public text added to the call, replacing the saved note'
        )
        .setMaxLength(PING_NOTE_MAX_LENGTH)
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
                    {
                        link,
                        count: requestedCount(interaction),
                        note: typedNote(interaction),
                    }
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
                if (result.kind === 'note_too_long') {
                    await editDeferred(
                        interaction,
                        `That note is too long. Keep it to ${result.max} characters.`
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

function typedNote(interaction: CommandInteraction): string | undefined {
    if (!interaction.isChatInputCommand()) return undefined
    return interaction.options.getString('note') ?? undefined
}
