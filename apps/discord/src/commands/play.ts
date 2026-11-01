import { internal } from '@nxt/backend/api'

import { turnCommand } from '~/lib/turnCommand'

export const playQ = turnCommand({
    name: 'playq',
    description: 'Move a Pinged Participant to Playing',
    mutation: internal.platformQueue.play,
    requirement: 'Only a Pinged Participant can start playing.',
    succeeded: (participant) => `${participant} is now playing.`,
})
