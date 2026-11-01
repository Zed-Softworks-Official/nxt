import { internal } from '@nxt/backend/api'
import { formatReference } from '@nxt/backend/reference'

import type { TwitchCommand } from './types'

// Twitch chat messages are capped at 500 characters, so view shows only the
// front of the Queue.
const SHOWN = 5

const PLATFORM_LABELS = {
    discord: 'Discord',
    twitch: 'Twitch',
    youtube: 'YouTube',
} as const

export const view: TwitchCommand = {
    cooldown: true,
    async run({ convex, link }) {
        const result = await convex.query(internal.platformQueue.view, {
            link,
        })
        if (result.kind === 'unlinked') return null

        const stateLine =
            result.state === 'open'
                ? 'The queue is open.'
                : 'The queue is paused.'
        if (result.waiting.length === 0) {
            return `${stateLine} Nobody is waiting.`
        }

        const entries = result.waiting
            .slice(0, SHOWN)
            .map(
                (entry, index) =>
                    `${index + 1}. ${formatReference(entry.reference)} ${entry.username} (${PLATFORM_LABELS[entry.platform]})`
            )
            .join(', ')
        const hidden = result.waiting.length - SHOWN
        const more = hidden > 0 ? ` …and ${hidden} more.` : ''
        return `${stateLine} Next: ${entries}${more}`
    },
}
