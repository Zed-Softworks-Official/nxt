import { internal } from '@nxt/backend/api'

import type { TwitchCommand } from './types'

// open and pause share the backend's Queue state mutation shape.
function stateCommand(
    mutation: typeof internal.platformQueue.open,
    state: 'open' | 'paused'
): TwitchCommand {
    return {
        admin: true,
        async run({ convex, link }) {
            const result = await convex.mutation(mutation, { link })
            switch (result.kind) {
                case 'unlinked':
                    return null
                case 'ok':
                    return `The queue is ${state}.`
                case 'already':
                    return `The queue is already ${state}.`
            }
        },
    }
}

export const open = stateCommand(internal.platformQueue.open, 'open')
export const pause = stateCommand(internal.platformQueue.pause, 'paused')
