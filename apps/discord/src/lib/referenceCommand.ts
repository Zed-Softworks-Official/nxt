import {
    describeParticipant,
    type Participant,
    TURN_STATE_WORDING,
    type TurnState,
} from '@nxt/backend/participant'
import { formatReference, parseReference } from '@nxt/backend/reference'
import type { CommandInteraction } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import {
    type DiscordLink,
    editDeferred,
    NOT_CONNECTED,
    runQueueCommand,
} from '~/lib/queueGate'
import type { Command } from '~/lib/types'

type Refusal =
    | { kind: 'unknown_reference' }
    | { kind: 'wrong_state'; status: TurnState }
    | { kind: 'unlinked' }

// An Admin command that targets one Participant by reference: the Turn
// commands, removeq and moveq. Gated on Manage Server (ADR-0001), targeted by
// reference (ADR-0005).
export function referenceCommand<
    Result extends { kind: 'ok'; participant: Participant } | Refusal,
>(spec: {
    name: string
    description: string
    // Options after the reference, such as moveq's Position.
    addOptions?: (data: SlashCommandBuilder) => void
    act: (
        convex: QueueConvex,
        args: { link: DiscordLink; reference: number },
        interaction: CommandInteraction
    ) => Promise<Result>
    // Why the wrong-state reply is a refusal, e.g. "Only a Pinged Participant can start playing."
    requirement?: string
    succeeded: (
        participant: string,
        result: Extract<Result, { kind: 'ok' }>
    ) => string
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
    spec.addOptions?.(data)

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
                        await editDeferred(interaction, notAReference(text))
                        return
                    }

                    const result = await spec.act(
                        convex,
                        { link, reference },
                        interaction
                    )
                    await editDeferred(
                        interaction,
                        isOk(result)
                            ? spec.succeeded(
                                  describeParticipant(result.participant),
                                  result
                              )
                            : // TS can't narrow a generic union in the else branch.
                              refusalFor(
                                  result as Refusal,
                                  reference,
                                  spec.requirement
                              )
                    )
                },
            })
        },
    }
}

function isOk<Result extends { kind: string }>(
    result: Result
): result is Extract<Result, { kind: 'ok' }> {
    return result.kind === 'ok'
}

export function notAReference(text: string): string {
    return `"${text}" is not a Participant reference. Use one like q-42.`
}

// The replies every reference command shares when it can't act.
export function refusalFor(
    result: Refusal,
    reference: number,
    requirement?: string
): string {
    switch (result.kind) {
        case 'unlinked':
            return NOT_CONNECTED
        case 'unknown_reference':
            return `Nobody in the queue has the reference ${formatReference(reference)}.`
        case 'wrong_state':
            return [
                `${formatReference(reference)} ${TURN_STATE_WORDING[result.status]}.`,
                requirement,
            ]
                .filter(Boolean)
                .join(' ')
    }
}
