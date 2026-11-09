import { internal } from '@nxt/backend/api'

import { referenceCommand } from '~/lib/turnCommand'

// Remove (silent): ends one entry whatever its state.
export const removeQ = referenceCommand({
    name: 'removeq',
    description: 'Take a Participant out of the queue',
    act: (convex, args) => convex.mutation(internal.platformQueue.remove, args),
    succeeded: (participant) => `Removed ${participant}.`,
})
