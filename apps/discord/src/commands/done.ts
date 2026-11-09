import { internal } from '@nxt/backend/api'

import { referenceCommand } from '~/lib/referenceCommand'

export const doneQ = referenceCommand({
    name: 'doneq',
    description: "Finish a Playing Participant's turn",
    act: (convex, args) => convex.mutation(internal.platformQueue.done, args),
    requirement: 'Only a Playing Participant can finish.',
    succeeded: (participant) => `${participant} is done.`,
})
