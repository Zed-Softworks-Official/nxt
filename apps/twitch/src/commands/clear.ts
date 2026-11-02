import { internal } from '@nxt/backend/api'

import type { TwitchCommand } from './types'

// Removes waiting Participants from every platform; Pinged and Playing stay.
export const clear: TwitchCommand = {
    admin: true,
    async run({ convex, link }) {
        const result = await convex.mutation(internal.platformQueue.clear, {
            link,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'ok':
                return `Cleared ${result.cleared} from the queue.`
            case 'empty':
                return 'Nobody is waiting, so there is nothing to clear.'
        }
    },
}
