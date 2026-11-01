import { internal } from '@nxt/backend/api'

import type { TwitchCommand } from './types'

export const open: TwitchCommand = {
    admin: true,
    async run({ convex, link }) {
        const result = await convex.mutation(internal.platformQueue.open, {
            link,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'ok':
                return 'The queue is open.'
            case 'already':
                return 'The queue is already open.'
        }
    },
}
