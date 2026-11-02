import { internal } from '@nxt/backend/api'

import { describeParticipant } from '@nxt/backend/participant'

import type { TwitchCommand } from './types'

// Twitch chat messages are capped at 500 characters, so one ping calls at
// most this many Participants.
const MAX_COUNT = 10

const USAGE = `Use !nxt ping, or !nxt ping <count> with a count from 1 to ${MAX_COUNT}.`

export const ping: TwitchCommand = {
    admin: true,
    async run({ convex, link, arg }) {
        const count = parseCount(arg)
        if (count === null) return USAGE

        const result = await convex.mutation(internal.platformQueue.ping, {
            link,
            count,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'empty':
                return 'Nobody is waiting in the queue.'
            case 'ok':
                return `Pinged ${result.pinged.map(describeParticipant).join(', ')}.`
        }
    },
}

// Empty means 1. Anything other than a whole number in range is null.
function parseCount(arg: string): number | null {
    if (arg === '') return 1
    if (!/^\d+$/.test(arg)) return null
    const count = Number(arg)
    return count >= 1 && count <= MAX_COUNT ? count : null
}
