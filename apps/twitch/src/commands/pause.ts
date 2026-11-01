import { internal } from '@nxt/backend/api'

import type { TwitchCommand } from './types'

export const pause: TwitchCommand = {
    admin: true,
    async run({ convex, link }) {
        const result = await convex.mutation(internal.platformQueue.pause, {
            link,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'ok':
                return 'The queue is paused.'
            case 'already':
                return 'The queue is already paused.'
        }
    },
}
