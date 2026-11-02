import { internal } from '@nxt/backend/api'
import {
    action,
    internalMutation,
    internalQuery,
} from '@nxt/backend/server'
import { v } from 'convex/values'

import { dropPendingForLink } from '../model/announcement'
import { consumedLinkState, consumeLinkState } from '../model/linkState'
import { queueForCommunity } from '../model/pausedQueue'
import { twitchClient } from '../model/twitchClient'

// Twitch linking (ADR-0002). The `/twitch` HTTP route drives the link
// callback through these internal functions; the dashboard unlinks with
// `unlink`. Twitch network calls go through the injectable Twitch client.

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

const grant = v.object({
    accessToken: v.string(),
    refreshToken: v.string(),
    scopes: v.array(v.string()),
    expiresAt: v.number(),
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
        const community = await ctx.db
            .query('communities')
            .withIndex('byOwner', (q) => q.eq('ownerId', args.ownerId))
            .first()
        if (!community) throw new Error('Community not found')

        const links = await ctx.db
            .query('platformLinks')
            .withIndex('byCommunity', (q) => q.eq('communityId', community._id))
            .collect()
        const twitchLinks = links.filter(
            (link) => link.platform === 'twitch' && link.enabled
        )
        if (twitchLinks.length === 0) return []

        const queue = await queueForCommunity(ctx, community._id)
        if (queue) {
            const participants = await ctx.db
                .query('participants')
                .withIndex('byQueue', (q) => q.eq('queueId', queue._id))
                .collect()
            for (const participant of participants) {
                if (
                    participant.platform === 'twitch' &&
                    participant.status === 'waiting'
                ) {
                    await ctx.db.delete('participants', participant._id)
                }
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
                ...(link.twitch
                    ? { twitch: { ...link.twitch, subscriptionId: undefined } }
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
                console.error('Error deleting Twitch EventSub subscription', error)
            }
        }
        return null
    },
})
