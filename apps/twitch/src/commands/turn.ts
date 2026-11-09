import { internal } from '@nxt/backend/api'
import {
    describeParticipant,
    TURN_STATE_WORDING,
    type TurnState,
} from '@nxt/backend/participant'
import { formatReference, parseReference } from '@nxt/backend/reference'

import type { TwitchCommand } from './types'

// The reference a command targets, or the reply refusing what was typed.
type ReadReference =
    | { kind: 'reference'; reference: number }
    | { kind: 'refused'; reply: string }

export function readReference(name: string, arg: string): ReadReference {
    if (arg === '') {
        return {
            kind: 'refused',
            reply: `Use !${name} <reference>, such as !${name} q-42.`,
        }
    }
    const reference = parseReference(arg)
    return reference === null
        ? { kind: 'refused', reply: notAReference(arg) }
        : { kind: 'reference', reference }
}

export function notAReference(text: string): string {
    return `"${text}" is not a Participant reference. Use one like q-42.`
}

type Refusal =
    | { kind: 'unlinked' }
    | { kind: 'unknown_reference' }
    | { kind: 'wrong_state'; status: TurnState }

// The replies every reference-targeting command gives when it can't act: none
// when the channel isn't linked, and the same wording for a reference that
// matches nobody or a Participant in the wrong state for the command.
export function refusalFor(
    result: Refusal,
    reference: number,
    // Why the wrong-state reply is a refusal.
    requirement = ''
): string | null {
    switch (result.kind) {
        case 'unlinked':
            return null
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
            const read = readReference(spec.name, arg)
            if (read.kind === 'refused') return read.reply

            const result = await convex.mutation(spec.mutation, {
                link,
                reference: read.reference,
            })
            if (result.kind !== 'ok') {
                return refusalFor(result, read.reference, spec.requirement)
            }
            return spec.succeeded(describeParticipant(result.participant))
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
