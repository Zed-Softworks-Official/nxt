import { internal } from '@nxt/backend/api'

import { turnCommand } from '~/lib/turnCommand'

export const returnQ = turnCommand({
    name: 'returnq',
    description: 'Put a Pinged Participant back in the queue',
    mutation: internal.platformQueue.returnToQueue,
    requirement: 'Only a Pinged Participant can return to the queue.',
    succeeded: (participant) => `${participant} is back in the queue.`,
})
