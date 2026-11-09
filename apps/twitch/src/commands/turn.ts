import { internal } from '@nxt/backend/api'
import {
    describeParticipant,
    TURN_STATE_WORDING,
    type TurnState,
} from '@nxt/backend/participant'
import { formatReference, parseReference } from '@nxt/backend/reference'

import type { TwitchCommand } from './types'

// The replies every reference-targeting command gives when the reference
// matches nobody, or a Participant in the wrong state for the command.
export function unknownReference(reference: number): string {
    return `Nobody in the queue has the reference ${formatReference(reference)}.`
}

export function wrongState(
    reference: number,
    status: TurnState,
    requirement: string
): string {
    return `${formatReference(reference)} ${TURN_STATE_WORDING[status]}. ${requirement}`
}

// play, return and done share the backend's Turn mutation shape.
type TurnMutation = typeof internal.platformQueue.play

// A Turn command that targets one Participant by reference (ADR-0005). The
// Participant may be on any platform linked to the Community.
function turnCommand(spec: {
    name: string
    mutation: TurnMutation
    // Why the wrong-state reply is a refusal.
    requirement: string
    succeeded: (participant: string) => string
}): TwitchCommand {
    return {
        admin: true,
        async run({ convex, link, arg }) {
            if (arg === '') {
                return `Use !${spec.name} <reference>, such as !${spec.name} q-42.`
            }
            const reference = parseReference(arg)
            if (reference === null) {
                return `"${arg}" is not a Participant reference. Use one like q-42.`
            }

            const result = await convex.mutation(spec.mutation, {
                link,
                reference,
            })
            switch (result.kind) {
                case 'unlinked':
                    return null
                case 'unknown_reference':
                    return unknownReference(reference)
                case 'wrong_state':
                    return wrongState(
                        reference,
                        result.status,
                        spec.requirement
                    )
                case 'ok':
                    return spec.succeeded(
                        describeParticipant(result.participant)
                    )
            }
        },
    }
}

export const play = turnCommand({
    name: 'playq',
    mutation: internal.platformQueue.play,
    requirement: 'Only a Pinged Participant can start playing.',
    succeeded: (participant) => `${participant} is now playing.`,
})

export const returnToQueue = turnCommand({
    name: 'returnq',
    mutation: internal.platformQueue.returnToQueue,
    requirement: 'Only a Pinged Participant can return to the queue.',
    succeeded: (participant) => `${participant} is back in the queue.`,
})

export const done = turnCommand({
    name: 'doneq',
    mutation: internal.platformQueue.done,
    requirement: 'Only a Playing Participant can finish.',
    succeeded: (participant) => `${participant} is done.`,
})
