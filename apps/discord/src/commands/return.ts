import { internal } from '@nxt/backend/api'

import { referenceCommand } from '~/lib/referenceCommand'

export const returnQ = referenceCommand({
    name: 'returnq',
    description: 'Put a Pinged Participant back in the queue',
    act: (convex, args) =>
        convex.mutation(internal.platformQueue.returnToQueue, args),
    requirement: 'Only a Pinged Participant can return to the queue.',
    succeeded: (participant) => `${participant} is back in the queue.`,
})
