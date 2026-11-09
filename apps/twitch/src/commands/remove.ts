import { internal } from '@nxt/backend/api'
import { describeParticipant } from '@nxt/backend/participant'

import { readReference, refusalFor } from './turn'
import type { TwitchCommand } from './types'

// Ends one Participant's entry, whatever its state. Silent: the reply names
// the Participant without an `@`, so they are not called out in chat.
export const remove: TwitchCommand = {
    admin: true,
    async run({ convex, link, arg }) {
        const read = readReference('removeq', arg)
        if (read.kind === 'refused') return read.reply

        const result = await convex.mutation(internal.platformQueue.remove, {
            link,
            reference: read.reference,
        })
        if (result.kind !== 'ok') return refusalFor(result, read.reference)
        return `Removed ${describeParticipant(result.participant)}.`
    },
}
