import type { Doc, Id } from '@nxt/backend/dataModel'
import type { MutationCtx, QueryCtx } from '@nxt/backend/server'
import { v } from 'convex/values'

import type { Platform, PlatformLinkRef } from './queue'

// The Announcement outbox (ADR-0004). Queue changes insert Announcements in
// the same mutation; each platform's adapter reads its pending ones, posts
// them, and settles each as delivered. An Announcement whose Platform Link is
// gone (unlinked, disabled, or now owned by another Community) is dropped
// instead of posted.

const participantSnapshot = v.object({
    platformUserId: v.string(),
    username: v.string(),
    login: v.optional(v.string()),
    reference: v.number(),
})

// What an adapter sees for each pending Announcement.
export const pendingAnnouncement = v.union(
    v.object({
        action: v.literal('post'),
        id: v.id('announcements'),
        kind: v.literal('pinged'),
        platformId: v.string(),
        // Where to post. Discord: the Command channel, else the Participant's
        // last channel. Twitch: the broadcaster's channel.
        channelId: v.string(),
        participant: participantSnapshot,
    }),
    v.object({
        action: v.literal('drop'),
        id: v.id('announcements'),
    })
)

// Announce that `participant` was Pinged, in their own platform's space.
// A Community with no Platform Link for that platform gets no Announcement.
export async function announcePinged(
    ctx: MutationCtx,
    communityId: Id<'communities'>,
    participant: Doc<'participants'>
) {
    const sameSpace = (enabled: boolean) =>
        ctx.db
            .query('platformLinks')
            .withIndex('byCommunityAndPlatformAndEnabled', (q) =>
                q
                    .eq('communityId', communityId)
                    .eq('platform', participant.platform)
                    .eq('enabled', enabled)
            )
            .first()
    const link = (await sameSpace(true)) ?? (await sameSpace(false))
    if (!link) return

    await ctx.db.insert('announcements', {
        communityId,
        platform: participant.platform,
        platformId: link.platformId,
        participant: {
            platformUserId: participant.platformUserId,
            username: participant.username,
            ...(participant.login ? { login: participant.login } : {}),
            reference: participant.reference,
        },
        ...(participant.lastChannelId
            ? { fallbackChannelId: participant.lastChannelId }
            : {}),
        kind: 'pinged',
    })
}

function unsettled(ctx: QueryCtx, platform: Platform) {
    return ctx.db
        .query('announcements')
        .withIndex('byPlatformAndDeliveredAt', (q) =>
            q.eq('platform', platform).eq('deliveredAt', undefined)
        )
}

// Pending Announcements for one platform, oldest first.
export async function pending(ctx: QueryCtx, platform: Platform) {
    const rows = await unsettled(ctx, platform).take(100)
    const result = []
    for (const row of rows) {
        const link = await ctx.db
            .query('platformLinks')
            .withIndex('byPlatform', (q) =>
                q.eq('platform', row.platform).eq('platformId', row.platformId)
            )
            .first()
        const channelId = link ? channelFor(row, link) : null
        if (
            !link ||
            !link.enabled ||
            link.communityId !== row.communityId ||
            !channelId
        ) {
            result.push({ action: 'drop' as const, id: row._id })
            continue
        }
        result.push({
            action: 'post' as const,
            id: row._id,
            kind: row.kind,
            platformId: row.platformId,
            channelId,
            participant: row.participant,
        })
    }
    return result
}

function channelFor(
    announcement: Doc<'announcements'>,
    link: Doc<'platformLinks'>
): string | null {
    switch (announcement.platform) {
        case 'discord':
            return (
                link.commandChannelId ?? announcement.fallbackChannelId ?? null
            )
        case 'twitch':
        case 'youtube':
            return link.platformId
    }
}

// Settle one Announcement. Settling twice is a no-op.
export async function settle(
    ctx: MutationCtx,
    id: Id<'announcements'>,
    outcome: 'delivered' | 'dropped'
) {
    const row = await ctx.db.get('announcements', id)
    if (!row || row.deliveredAt !== undefined) return
    await ctx.db.patch('announcements', id, {
        deliveredAt: Date.now(),
        ...(outcome === 'dropped' ? { dropped: true } : {}),
    })
}

// Drop every pending Announcement for one Platform Link. Unlinking calls this.
export async function dropPendingForLink(
    ctx: MutationCtx,
    communityId: Id<'communities'>,
    link: PlatformLinkRef
) {
    const rows = await ctx.db
        .query('announcements')
        .withIndex('byCommunityAndPlatformAndPlatformIdAndDeliveredAt', (q) =>
            q
                .eq('communityId', communityId)
                .eq('platform', link.platform)
                .eq('platformId', link.platformId)
                .eq('deliveredAt', undefined)
        )
        .collect()
    for (const row of rows) {
        await settle(ctx, row._id, 'dropped')
    }
    return rows.length
}

// Settled Announcements are kept this long, then pruned.
export const RETENTION_MS = 24 * 60 * 60 * 1000

const PRUNE_BATCH = 500

// Delete settled Announcements older than the retention window. Returns how
// many were deleted and whether more remain past the batch.
export async function prune(ctx: MutationCtx, now: number) {
    const rows = await ctx.db
        .query('announcements')
        .withIndex('byDeliveredAt', (q) =>
            q.gt('deliveredAt', 0).lt('deliveredAt', now - RETENTION_MS)
        )
        .take(PRUNE_BATCH)
    for (const row of rows) {
        await ctx.db.delete('announcements', row._id)
    }
    return { pruned: rows.length, more: rows.length === PRUNE_BATCH }
}
