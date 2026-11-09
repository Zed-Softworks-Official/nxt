import { internal } from '@nxt/backend/api'
import { describeParticipant } from '@nxt/backend/participant'
import { parseReference } from '@nxt/backend/reference'

import { unknownReference, wrongState } from './turn'
import type { TwitchCommand } from './types'

const USAGE =
    'Use !moveq <reference> <position>, such as !moveq q-42 3, with a position of 1 or more.'

// Gives a waiting Participant a new Position. A Position past the end moves
// them to the back. Silent: the reply names the Participant without an `@`.
export const move: TwitchCommand = {
    admin: true,
    async run({ convex, link, arg }) {
        const parsed = parseArg(arg)
        if (parsed === null) return USAGE

        const result = await convex.mutation(internal.platformQueue.move, {
            link,
            reference: parsed.reference,
            to: { position: parsed.position },
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'unknown_reference':
                return unknownReference(parsed.reference)
            case 'wrong_state':
                return wrongState(
                    parsed.reference,
                    result.status,
                    'Only a waiting Participant can be moved.'
                )
            case 'ok':
                return `Moved ${describeParticipant(result.participant)} to Position ${result.position}.`
        }
    },
}

// `<reference> <position>`, the Position a whole number from 1. Anything else
// is null, so a typo never reorders the Queue.
function parseArg(arg: string): { reference: number; position: number } | null {
    const match = /^(\S+)\s+([1-9]\d*)$/.exec(arg)
    if (!match?.[1] || !match[2]) return null
    const reference = parseReference(match[1])
    const position = Number(match[2])
    if (reference === null || !Number.isSafeInteger(position)) return null
    return { reference, position }
}
