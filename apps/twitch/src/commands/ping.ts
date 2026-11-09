import { internal } from '@nxt/backend/api'

import { describeParticipant } from '@nxt/backend/participant'
import { parseReference } from '@nxt/backend/reference'

import { unknownReference, wrongState } from './turn'
import type { TwitchCommand } from './types'

// Twitch chat messages are capped at 500 characters, so one ping calls at
// most this many Participants.
const MAX_COUNT = 10

const USAGE = `Use !pingq, !pingq <count>, !pingq <count> <note>, or !pingq q-<n> <note>, with a count from 1 to ${MAX_COUNT}.`

export const ping: TwitchCommand = {
    admin: true,
    async run({ convex, link, arg }) {
        const targeted = parseTargeted(arg)
        if (targeted !== null) {
            // `q-` followed by something that isn't a reference.
            if (targeted.reference === null) return USAGE
            const result = await convex.mutation(
                internal.platformQueue.pingOne,
                { link, reference: targeted.reference, note: targeted.note }
            )
            switch (result.kind) {
                case 'unlinked':
                    return null
                case 'note_too_long':
                    return noteTooLong(result.max)
                case 'unknown_reference':
                    return unknownReference(targeted.reference)
                case 'wrong_state':
                    return wrongState(
                        targeted.reference,
                        result.status,
                        'Only a waiting Participant can be Pinged.'
                    )
                case 'ok':
                    return `Pinged ${describeParticipant(result.participant)}.`
            }
        }

        const parsed = parseArg(arg)
        if (parsed === null) return USAGE

        const result = await convex.mutation(internal.platformQueue.ping, {
            link,
            count: parsed.count,
            note: parsed.note,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'empty':
                return 'Nobody is waiting in the queue.'
            case 'note_too_long':
                return noteTooLong(result.max)
            case 'ok':
                return `Pinged ${result.pinged.map(describeParticipant).join(', ')}.`
        }
    },
}

function noteTooLong(max: number): string {
    return `That note is too long. Keep it to ${max} characters.`
}

// `q-<n> [note]`: a targeted Ping. The `q-` is required, so a bare number is
// always a count and never a reference.
function parseTargeted(
    arg: string
): { reference: number | null; note?: string } | null {
    const match = /^(q-\S+)(?:\s+(.+))?$/is.exec(arg)
    if (!match?.[1]) return null
    return { reference: parseReference(match[1]), note: match[2] }
}

// Empty means a count of 1. Otherwise a whole number in range comes first, and
// anything after it is the note. Anything else is null, so a typo is refused
// instead of publicly calling someone.
function parseArg(arg: string): { count: number; note?: string } | null {
    if (arg === '') return { count: 1 }
    const match = /^(\d+)(?:\s+(.+))?$/s.exec(arg)
    if (!match) return null
    const count = Number(match[1])
    if (count < 1 || count > MAX_COUNT) return null
    return { count, note: match[2] }
}
