import { internal } from '@nxt/backend/api'

import { describeParticipant } from '@nxt/backend/participant'

import type { TwitchCommand } from './types'

// Twitch chat messages are capped at 500 characters, so one ping calls at
// most this many Participants.
const MAX_COUNT = 10

const USAGE = `Use !pingq, !pingq <count>, or !pingq <count> <note>, with a count from 1 to ${MAX_COUNT}.`

export const ping: TwitchCommand = {
    admin: true,
    async run({ convex, link, arg }) {
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
                return `That note is too long. Keep it to ${result.max} characters.`
            case 'ok':
                return `Pinged ${result.pinged.map(describeParticipant).join(', ')}.`
        }
    },
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
