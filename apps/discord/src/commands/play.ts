import { internal } from '@nxt/backend/api'

import { referenceCommand } from '~/lib/referenceCommand'

export const playQ = referenceCommand({
    name: 'playq',
    description: 'Move a Pinged Participant to Playing',
    act: (convex, args) => convex.mutation(internal.platformQueue.play, args),
    requirement: 'Only a Pinged Participant can start playing.',
    succeeded: (participant) => `${participant} is now playing.`,
})
