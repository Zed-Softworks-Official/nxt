import { internal } from '@nxt/backend/api'

import type { TwitchCommand } from './types'

export const leave: TwitchCommand = {
    async run({ convex, message, link }) {
        const result = await convex.mutation(internal.platformQueue.leave, {
            link,
            platformUserId: message.chatterId,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'ok':
                return 'You left the queue.'
            case 'absent':
                return 'You are not in the queue.'
        }
    },
}
