import type { internal } from '@nxt/backend/api'
import { formatReference, parseReference } from '@nxt/backend/reference'
import type { CommandInteraction } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { describeParticipant, type Platform } from '~/lib/participant'
import { editDeferred, NOT_CONNECTED, runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

// playq, returnq and doneq share the backend's Turn mutation shape.
type TurnMutation = typeof internal.platformQueue.play

type TurnState = 'waiting' | 'pinged' | 'playing'

type TurnResult =
    | {
          kind: 'ok'
          participant: {
              reference: number
              username: string
              platform: Platform
          }
      }
    | { kind: 'unknown_reference' }
    | { kind: 'wrong_state'; status: TurnState }
    | { kind: 'unlinked' }

const STATE_WORDING: Record<TurnState, string> = {
    waiting: 'is waiting in the queue',
    pinged: 'is Pinged',
    playing: 'is playing',
}

// A Turn command that targets one Participant by reference: playq, returnq,
// doneq. Gated on Manage Server (ADR-0001), targeted by reference (ADR-0005).
export function turnCommand(spec: {
    name: string
    description: string
    mutation: TurnMutation
    // Why the wrong-state reply is a refusal, e.g. "Only a Pinged Participant can start playing."
    requirement: string
    succeeded: (participant: string) => string
}): Command {
    const data = new SlashCommandBuilder()
        .setName(spec.name)
        .setDescription(spec.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    data.addStringOption((option) =>
        option
            .setName('reference')
            .setDescription('Participant reference, such as q-42')
            .setRequired(true)
    )

    return {
        data,
        async execute(interaction: CommandInteraction, client?: QueueConvex) {
            const convex = client ?? getConvex()
            await runQueueCommand(interaction, convex, {
                kind: 'admin',
                run: async ({ link }) => {
                    const text = interaction.isChatInputCommand()
                        ? (interaction.options.getString('reference') ?? '')
                        : ''
                    const reference = parseReference(text)
                    if (reference === null) {
                        await editDeferred(
                            interaction,
                            `"${text}" is not a Participant reference. Use one like q-42.`
                        )
                        return
                    }

                    const result = await convex.mutation(spec.mutation, {
                        link,
                        reference,
                    })
                    await editDeferred(
                        interaction,
                        replyFor(result, reference, spec)
                    )
                },
            })
        },
    }
}

function replyFor(
    result: TurnResult,
    reference: number,
    spec: { requirement: string; succeeded: (participant: string) => string }
): string {
    switch (result.kind) {
        case 'unlinked':
            return NOT_CONNECTED
        case 'unknown_reference':
            return `Nobody in the queue has the reference ${formatReference(reference)}.`
        case 'wrong_state':
            return `${formatReference(reference)} ${STATE_WORDING[result.status]}. ${spec.requirement}`
        case 'ok':
            return spec.succeeded(describeParticipant(result.participant))
    }
}
