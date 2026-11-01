import { internal } from '@nxt/backend/api'
import { formatReference } from '@nxt/backend/reference'

import type { TwitchCommand } from './types'

export const join: TwitchCommand = {
    async run({ convex, message, link }) {
        const result = await convex.mutation(internal.platformQueue.join, {
            link,
            platformUserId: message.chatterId,
            username: message.chatterName,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'ok':
                return `You joined the queue as ${formatReference(result.reference)}.`
            case 'paused':
                return 'The queue is paused, so you cannot join right now.'
            case 'already':
                return `You are already in the queue as ${formatReference(result.reference)}.`
        }
    },
}
