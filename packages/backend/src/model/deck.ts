import type { Id } from '@nxt/backend/dataModel'
import type { QueryCtx } from '@nxt/backend/server'
import { v } from 'convex/values'

import { queueForCommunity } from './pausedQueue'
import * as Queue from './queue'

// The deck-shaped Queue view a Paired deck subscribes to (ADR-0006). Slots
// are in join order, matching the dashboard's Pinged and Playing lists.
// References are carried so presses can target them (ADR-0005); the deck
// does not display them.

export const unpaired = v.object({ kind: v.literal('unpaired') })

const slot = {
    reference: v.number(),
    name: v.string(),
    platform: Queue.platform,
}

export const viewResult = v.union(
    v.object({
        kind: v.literal('ok'),
        state: v.union(v.literal('open'), v.literal('paused')),
        waitingCount: v.number(),
        pinged: v.array(
            v.object({
                ...slot,
                // When the Announcement calling them was created, while it is
                // still unposted. Pass to `isAnnouncementFailed` with the
                // current time: a query can't flip a flag as time passes.
                announcementPendingSince: v.union(v.number(), v.null()),
            })
        ),
        playing: v.array(v.object(slot)),
    }),
    unpaired
)

export async function view(ctx: QueryCtx, communityId: Id<'communities'>) {
    const queue = await Queue.view(
        ctx,
        await queueForCommunity(ctx, communityId)
    )
    return {
        kind: 'ok' as const,
        state: queue.state,
        waitingCount: queue.waiting.length,
        pinged: queue.pinged.map((entry) => ({
            ...slotOf(entry),
            announcementPendingSince: entry.announcementPendingSince ?? null,
        })),
        playing: queue.playing.map(slotOf),
    }
}

function slotOf(entry: {
    reference: number
    username: string
    platform: Queue.Platform
}) {
    return {
        reference: entry.reference,
        name: entry.username,
        platform: entry.platform,
    }
}
