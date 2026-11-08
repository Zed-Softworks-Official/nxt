import { internal } from '@nxt/backend/api'
import {
    action,
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
} from '@nxt/backend/server'
import { v } from 'convex/values'

import { dropPendingForLink } from '../model/announcement'
import { communityForOwner } from '../model/community'
import { consumedLinkState, consumeLinkState } from '../model/linkState'
import { queueForCommunity } from '../model/pausedQueue'
import { twitchClient } from '../model/twitchClient'
import { BROADCASTER_SUBSCRIPTIONS_SCOPE } from '../model/twitchLink'

// Twitch linking (ADR-0002). The `/twitch` HTTP route drives the link
// callback through these internal functions; the dashboard unlinks with
// `unlink`. Twitch network calls go through the injectable Twitch client.

async function enabledTwitchLink(
    ctx: QueryCtx | MutationCtx,
    broadcasterId: string
) {
    const link = await ctx.db
        .query('platformLinks')
        .withIndex('byPlatform', (q) =>
            q.eq('platform', 'twitch').eq('platformId', broadcasterId)
        )
        .first()
    return link?.enabled ? link : null
}

/** Consume a Twitch link `state`. Good once; see model/linkState.ts. */
export const consumeState = internalMutation({
    args: { state: v.string() },
    returns: consumedLinkState,
    handler: async (ctx, args) => {
        return await consumeLinkState(ctx, {
            platform: 'twitch',
            token: args.state,
        })
    },
})

/**
 * Whether a Twitch channel is linked to a Community other than
 * `communityId`. A channel belongs to at most one Community.
 */
export const linkedElsewhere = internalQuery({
    args: {
        communityId: v.id('communities'),
        broadcasterId: v.string(),
    },
    returns: v.boolean(),
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query('platformLinks')
            .withIndex('byPlatform', (q) =>
                q.eq('platform', 'twitch').eq('platformId', args.broadcasterId)
            )
            .first()
        return !!row && row.enabled && row.communityId !== args.communityId
    },
})

/** The broadcaster ID of the Community's enabled Twitch channel, if any. */
export const linkedChannel = internalQuery({
    args: { communityId: v.id('communities') },
    returns: v.union(v.string(), v.null()),
    handler: async (ctx, args) => {
        const link = await ctx.db
            .query('platformLinks')
            .withIndex('byCommunityAndPlatformAndEnabled', (q) =>
                q
                    .eq('communityId', args.communityId)
                    .eq('platform', 'twitch')
                    .eq('enabled', true)
            )
            .first()
        return link?.platformId ?? null
    },
})

const grant = v.object({
    accessToken: v.string(),
    refreshToken: v.string(),
    scopes: v.array(v.string()),
    expiresAt: v.number(),
})

/**
 * The stored grant of an enabled Twitch channel, or null if it has none Nxt can
 * use. Internal, so tokens never reach a browser.
 */
export const grantFor = internalQuery({
    args: { broadcasterId: v.string() },
    returns: v.union(grant, v.null()),
    handler: async (ctx, args) => {
        const link = await enabledTwitchLink(ctx, args.broadcasterId)
        if (!link?.twitch || link.twitch.grantRevoked) return null
        if (
            !link.twitch.grant.scopes.includes(BROADCASTER_SUBSCRIPTIONS_SCOPE)
        ) {
            return null
        }
        return link.twitch.grant
    },
})

// How long one action may hold the claim to refresh a grant, in case it dies.
const GRANT_REFRESH_CLAIM_MS = 15_000

/**
 * Claim the one refresh of a grant (see model/twitchGrant.ts). `changed` means
 * the stored grant is no longer the one the caller saw, so it should look again.
 */
export const claimGrantRefresh = internalMutation({
    args: { broadcasterId: v.string(), refreshToken: v.string() },
    returns: v.union(
        v.literal('claimed'),
        v.literal('held'),
        v.literal('changed')
    ),
    handler: async (ctx, args) => {
        const link = await enabledTwitchLink(ctx, args.broadcasterId)
        if (!link?.twitch) return 'changed' as const
        if (link.twitch.grant.refreshToken !== args.refreshToken) {
            return 'changed' as const
        }
        if ((link.twitch.grantRefreshUntil ?? 0) > Date.now()) {
            return 'held' as const
        }
        await ctx.db.patch('platformLinks', link._id, {
            twitch: {
                ...link.twitch,
                grantRefreshUntil: Date.now() + GRANT_REFRESH_CLAIM_MS,
            },
        })
        return 'claimed' as const
    },
})

/**
 * Store a refreshed grant, unless a Reconnect replaced the grant meanwhile.
 * Twitch may leave out the scopes, and a refresh cannot change them.
 */
export const saveRefreshedGrant = internalMutation({
    args: {
        broadcasterId: v.string(),
        previousRefreshToken: v.string(),
        grant,
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const link = await enabledTwitchLink(ctx, args.broadcasterId)
        if (link?.twitch?.grant.refreshToken !== args.previousRefreshToken) {
            return null
        }
        await ctx.db.patch('platformLinks', link._id, {
            twitch: {
                ...link.twitch,
                grant: {
                    ...args.grant,
                    scopes:
                        args.grant.scopes.length > 0
                            ? args.grant.scopes
                            : link.twitch.grant.scopes,
                },
                grantRefreshUntil: undefined,
            },
        })
        return null
    },
})

/** End a failed refresh, recording a grant Twitch refused as revoked. */
export const endGrantRefresh = internalMutation({
    args: {
        broadcasterId: v.string(),
        refreshToken: v.string(),
        revoked: v.boolean(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const link = await enabledTwitchLink(ctx, args.broadcasterId)
        if (link?.twitch?.grant.refreshToken !== args.refreshToken) return null
        await ctx.db.patch('platformLinks', link._id, {
            twitch: {
                ...link.twitch,
                grantRefreshUntil: undefined,
                ...(args.revoked ? { grantRevoked: true } : {}),
            },
        })
        return null
    },
})

/**
 * Save the Twitch Platform Link for a broadcaster who signed in. The
 * channel's single row is created, or re-enabled and moved to this
 * Community if it was unlinked. Refused if another Community has it linked.
 */
export const saveLink = internalMutation({
    args: {
        communityId: v.id('communities'),
        broadcaster: v.object({
            id: v.string(),
            login: v.string(),
            displayName: v.string(),
        }),
        grant,
        subscriptionId: v.string(),
    },
    returns: v.union(
        v.object({ ok: v.literal(true) }),
        v.object({ ok: v.literal(false), reason: v.literal('taken') })
    ),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('platformLinks')
            .withIndex('byPlatform', (q) =>
                q.eq('platform', 'twitch').eq('platformId', args.broadcaster.id)
            )
            .first()
        if (existing?.enabled && existing.communityId !== args.communityId) {
            return { ok: false as const, reason: 'taken' as const }
        }

        const fields = {
            communityId: args.communityId,
            enabled: true,
            platform: 'twitch' as const,
            platformId: args.broadcaster.id,
            platformName: 'Twitch',
            twitch: {
                login: args.broadcaster.login,
                displayName: args.broadcaster.displayName,
                grant: args.grant,
                subscriptionId: args.subscriptionId,
                // A Reconnect keeps the setting. Unlinking already cleared it.
                subRequirement: existing?.twitch?.subRequirement,
            },
        }
        if (existing) {
            await ctx.db.patch('platformLinks', existing._id, fields)
        } else {
            await ctx.db.insert('platformLinks', fields)
        }
        return { ok: true as const }
    },
})

/**
 * Disable the owner's enabled Twitch Platform Link: remove that platform's
 * waiting Participants (Pinged and Playing stay) and drop its pending
 * Announcements. Returns the EventSub subscriptions left to delete.
 */
export const disableLink = internalMutation({
    args: { ownerId: v.string() },
    returns: v.array(v.string()),
    handler: async (ctx, args) => {
        const community = await communityForOwner(ctx, args.ownerId)
        if (!community) throw new Error('Community not found')

        const twitchLinks = await ctx.db
            .query('platformLinks')
            .withIndex('byCommunityAndPlatformAndEnabled', (q) =>
                q
                    .eq('communityId', community._id)
                    .eq('platform', 'twitch')
                    .eq('enabled', true)
            )
            .collect()
        if (twitchLinks.length === 0) return []

        const queue = await queueForCommunity(ctx, community._id)
        if (queue) {
            const waiting = await ctx.db
                .query('participants')
                .withIndex('byQueueAndPlatformAndStatus', (q) =>
                    q
                        .eq('queueId', queue._id)
                        .eq('platform', 'twitch')
                        .eq('status', 'waiting')
                )
                .collect()
            for (const participant of waiting) {
                await ctx.db.delete('participants', participant._id)
            }
        }

        const subscriptionIds: string[] = []
        for (const link of twitchLinks) {
            await dropPendingForLink(ctx, community._id, {
                platform: 'twitch',
                platformId: link.platformId,
            })
            if (link.twitch?.subscriptionId) {
                subscriptionIds.push(link.twitch.subscriptionId)
            }
            await ctx.db.patch('platformLinks', link._id, {
                enabled: false,
                joinsOff: undefined,
                ...(link.twitch
                    ? {
                          twitch: {
                              ...link.twitch,
                              subscriptionId: undefined,
                              subRequirement: undefined,
                          },
                      }
                    : {}),
            })
        }
        return subscriptionIds
    },
})

/**
 * Unlink the signed-in Community owner's Twitch channel. Only the owner can
 * unlink, from the dashboard; Twitch moderators cannot (ADR-0002).
 */
export const unlink = action({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity()
        if (!identity) throw new Error('Not signed in')

        const subscriptionIds: string[] = await ctx.runMutation(
            internal.twitchLink.disableLink,
            { ownerId: identity.subject }
        )
        // The link is already disabled, so Nxt has stopped answering in the
        // channel even if Twitch refuses a delete here.
        const client = twitchClient()
        for (const id of subscriptionIds) {
            try {
                await client.deleteSubscription(id)
            } catch (error) {
                console.error(
                    'Error deleting Twitch EventSub subscription',
                    error
                )
            }
        }
        return null
    },
})
