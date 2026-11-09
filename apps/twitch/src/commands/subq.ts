import { internal } from '@nxt/backend/api'
import {
    SUB_REQUIREMENT_LABELS,
    type SubRequirement,
} from '@nxt/backend/subRequirement'

import type { TwitchCommand } from './types'

const SETTINGS: Record<string, SubRequirement> = {
    off: 'off',
    any: 'any',
    '2': 'tier2',
    '3': 'tier3',
}

// `!subq` shows the Sub requirement to anyone. `!subq <setting>` changes it for
// Twitch Admins.
export const subq: TwitchCommand = {
    // Only asking is flood-prone. Admins may change it as often as they like.
    cooldown: (arg) => arg === '',
    async run({ convex, link, arg, isAdmin }) {
        if (arg === '') {
            const current = await convex.query(
                internal.subRequirement.forChannel,
                { broadcasterId: link.platformId }
            )
            if (!current) return null
            return `The Sub requirement is ${SUB_REQUIREMENT_LABELS[current.requirement]}.`
        }

        if (!isAdmin) {
            return 'Only the broadcaster and moderators can run !subq.'
        }
        const requirement = Object.hasOwn(SETTINGS, arg.toLowerCase())
            ? SETTINGS[arg.toLowerCase()]
            : undefined
        if (!requirement) return 'Usage: !subq off|any|2|3'

        const result = await convex.action(
            internal.subRequirement.setForChannel,
            { broadcasterId: link.platformId, requirement }
        )
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'ok':
                return `The Sub requirement is now ${SUB_REQUIREMENT_LABELS[requirement]}.`
            case 'needs_reconnect':
                return 'The Community owner needs to reconnect Twitch in the dashboard first.'
            case 'not_eligible':
                return "This channel can't have subs yet, so the Sub requirement was not changed."
            case 'check_failed':
                return "Couldn't check this channel, try again."
        }
    },
}
