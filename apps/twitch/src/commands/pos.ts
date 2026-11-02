import { internal } from '@nxt/backend/api'
import { formatReference } from '@nxt/backend/reference'

import type { TwitchCommand } from './types'

export const pos: TwitchCommand = {
    cooldown: true,
    async run({ convex, message, link }) {
        const result = await convex.query(internal.platformQueue.position, {
            link,
            platformUserId: message.chatterId,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'waiting':
                return `You are #${result.position} in the queue (${formatReference(result.reference)}).`
            case 'pinged':
                return `You are not waiting: you have been pinged (${formatReference(result.reference)}).`
            case 'playing':
                return `You are not waiting: you are playing (${formatReference(result.reference)}).`
            case 'absent':
                return 'You are not waiting in the queue.'
        }
    },
}
