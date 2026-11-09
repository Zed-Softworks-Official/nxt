import { internal } from '@nxt/backend/api'
import { formatReference } from '@nxt/backend/reference'
import type { SubRequirement } from '@nxt/backend/subRequirement'

import type { TwitchCommand } from './types'

const SUB_NEEDED: Record<Exclude<SubRequirement, 'off'>, string> = {
    any: 'a sub',
    tier2: 'a Tier 2 or higher sub',
    tier3: 'a Tier 3 sub',
}

export const join: TwitchCommand = {
    async run({ convex, message, link, isAdmin, startCooldown }) {
        const result = await convex.action(internal.platformQueue.joinTwitch, {
            broadcasterId: link.platformId,
            platformUserId: message.chatterId,
            username: message.chatterName,
            login: message.chatterLogin,
            exempt: isAdmin,
        })
        switch (result.kind) {
            case 'unlinked':
                return null
            case 'ok':
                return `You joined the queue as ${formatReference(result.reference)}.`
            case 'paused':
                return 'The queue is paused, so you cannot join right now.'
            case 'joins_off':
                return 'Joining from Twitch is off right now.'
            case 'already':
                return `You are already in the queue as ${formatReference(result.reference)}.`
            case 'sub_required':
                startCooldown()
                return `This queue requires ${SUB_NEEDED[result.requirement]} to join.`
            case 'sub_check_failed':
                startCooldown()
                return "Couldn't check your subscription, try again."
        }
    },
}
