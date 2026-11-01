import { internal } from '@nxt/backend/api'

import { turnCommand } from '~/lib/turnCommand'

export const doneQ = turnCommand({
    name: 'doneq',
    description: "Finish a Playing Participant's turn",
    mutation: internal.platformQueue.done,
    requirement: 'Only a Playing Participant can finish.',
    succeeded: (participant) => `${participant} is done.`,
})
