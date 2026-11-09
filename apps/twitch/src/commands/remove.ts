import { internal } from '@nxt/backend/api'
import { describeParticipant } from '@nxt/backend/participant'

import { readReference, unknownReference } from './turn'
import type { TwitchCommand } from './types'

// Ends one Participant's entry, whatever its state. Silent: the reply names
// the Participant without an `@`, so they are not called out in chat.
export const remove: TwitchCommand = {
    admin: true,
    async run({ convex, link, arg }) {
        const reference = readReference('removeq', arg)
        if (typeof reference === 'string') return reference

        const result = await convex.mutation(internal.platformQueue.remove, {
            link,
            reference,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'unknown_reference':
                return unknownReference(reference)
            case 'ok':
                return `Removed ${describeParticipant(result.participant)}.`
        }
    },
}
