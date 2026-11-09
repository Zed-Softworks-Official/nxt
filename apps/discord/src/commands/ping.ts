import { internal } from '@nxt/backend/api'
import { describeParticipant, type Participant } from '@nxt/backend/participant'
import { PING_NOTE_MAX_LENGTH } from '@nxt/backend/pingNote'
import { parseReference } from '@nxt/backend/reference'
import type { CommandInteraction } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { getConvex, type QueueConvex } from '~/lib/convex'
import {
    type DiscordLink,
    editDeferred,
    NOT_CONNECTED,
    runQueueCommand,
} from '~/lib/queueGate'
import { notAReference, refusalFor } from '~/lib/referenceCommand'
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
        .setName('participant')
        .setDescription(
            'Call one waiting Participant by reference, such as q-42'
        )
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
                const participant = requestedParticipant(interaction)
                if (participant !== null) {
                    await pingOne(interaction, convex, link, participant)
                    return
                }

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
                    await editDeferred(interaction, noteTooLong(result.max))
                    return
                }
                await editDeferred(interaction, pinged(result.pinged))
            },
        })
    },
}

// A targeted Ping (ADR-0007): one waiting Participant, wherever they are.
async function pingOne(
    interaction: CommandInteraction,
    convex: QueueConvex,
    link: DiscordLink,
    text: string
) {
    if (interaction.isChatInputCommand()) {
        if (interaction.options.getInteger('count') !== null) {
            await editDeferred(
                interaction,
                'Give either a count or a participant, not both.'
            )
            return
        }
    }
    const reference = parseReference(text)
    if (reference === null) {
        await editDeferred(interaction, notAReference(text))
        return
    }

    const result = await convex.mutation(internal.platformQueue.pingOne, {
        link,
        reference,
        note: typedNote(interaction),
    })
    if (result.kind === 'ok') {
        await editDeferred(interaction, pinged([result.participant]))
        return
    }
    if (result.kind === 'note_too_long') {
        await editDeferred(interaction, noteTooLong(result.max))
        return
    }
    await editDeferred(
        interaction,
        refusalFor(
            result,
            reference,
            'Only a waiting Participant can be Pinged.'
        )
    )
}

function pinged(participants: Participant[]) {
    return `Pinged ${participants.map(describeParticipant).join(', ')}.`
}

function noteTooLong(max: number) {
    return `That note is too long. Keep it to ${max} characters.`
}

function requestedParticipant(interaction: CommandInteraction): string | null {
    if (!interaction.isChatInputCommand()) return null
    return interaction.options.getString('participant')
}

function requestedCount(interaction: CommandInteraction): number {
    if (!interaction.isChatInputCommand()) return 1
    return interaction.options.getInteger('count') ?? 1
}

function typedNote(interaction: CommandInteraction): string | undefined {
    if (!interaction.isChatInputCommand()) return undefined
    return interaction.options.getString('note') ?? undefined
}
