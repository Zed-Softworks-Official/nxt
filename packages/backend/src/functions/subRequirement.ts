import { internal } from '@nxt/backend/api'
import {
    type ActionCtx,
    action,
    internalAction,
    internalMutation,
    internalQuery,
    type MutationCtx,
    type QueryCtx,
    query,
} from '@nxt/backend/server'
import { v } from 'convex/values'

import { communityForOwner, ownedCommunity } from '../model/community'
import { subRequirementSetting } from '../model/queue'
import { twitchClient } from '../model/twitchClient'
import { BROADCASTER_SUBSCRIPTIONS_SCOPE } from '../model/twitchLink'
import type { SubRequirement } from '../subRequirement'

// The Sub requirement (CONTEXT.md). The owner sets it from Settings through
// `set`; Twitch Admins set it from chat through `setForChannel`.

type SetResult = {
    kind:
        | 'ok'
        | 'unlinked'
        | 'needs_reconnect'
        | 'not_eligible'
        | 'check_failed'
}

const setResult = v.object({
    kind: v.union(
        v.literal('ok'),
        v.literal('unlinked'),
        v.literal('needs_reconnect'),
        v.literal('not_eligible'),
        v.literal('check_failed')
    ),
})

const settingsResult = v.object({
    requirement: subRequirementSetting,
    needsReconnect: v.boolean(),
})

async function ownedTwitchLink(ctx: QueryCtx | MutationCtx, ownerId: string) {
    const community = await communityForOwner(ctx, ownerId)
    if (!community) return null
    return await ctx.db
        .query('platformLinks')
        .withIndex('byCommunityAndPlatformAndEnabled', (q) =>
            q
                .eq('communityId', community._id)
                .eq('platform', 'twitch')
                .eq('enabled', true)
        )
        .first()
}

async function channelLink(ctx: QueryCtx | MutationCtx, broadcasterId: string) {
    const link = await ctx.db
        .query('platformLinks')
        .withIndex('byPlatform', (q) =>
            q.eq('platform', 'twitch').eq('platformId', broadcasterId)
        )
        .first()
    return link?.enabled ? link : null
}

type TwitchLinkRow = NonNullable<Awaited<ReturnType<typeof channelLink>>>

function toSettings(link: TwitchLinkRow) {
    return {
        requirement: link.twitch?.subRequirement ?? ('off' as const),
        needsReconnect:
            !link.twitch ||
            link.twitch.grantRevoked === true ||
            !link.twitch.grant.scopes.includes(BROADCASTER_SUBSCRIPTIONS_SCOPE),
    }
}

// The signed-in owner's Sub requirement. Null without an enabled Twitch channel.
export const settings = query({
    args: {},
    returns: v.union(settingsResult, v.null()),
    handler: async (ctx) => {
        const community = await ownedCommunity(ctx)
        if (!community) return null
        const link = await ownedTwitchLink(ctx, community.ownerId)
        return link ? toSettings(link) : null
    },
})

// A linked channel's Sub requirement. Null without an enabled Platform Link.
export const forChannel = internalQuery({
    args: { broadcasterId: v.string() },
    returns: v.union(settingsResult, v.null()),
    handler: async (ctx, args) => {
        const link = await channelLink(ctx, args.broadcasterId)
        return link ? toSettings(link) : null
    },
})

export const channelForOwner = internalQuery({
    args: { ownerId: v.string() },
    returns: v.union(v.string(), v.null()),
    handler: async (ctx, args) => {
        const link = await ownedTwitchLink(ctx, args.ownerId)
        return link?.platformId ?? null
    },
})

export const save = internalMutation({
    args: { broadcasterId: v.string(), requirement: subRequirementSetting },
    returns: v.null(),
    handler: async (ctx, args) => {
        const link = await channelLink(ctx, args.broadcasterId)
        if (!link?.twitch) return null
        await ctx.db.patch('platformLinks', link._id, {
            twitch: {
                ...link.twitch,
                subRequirement:
                    args.requirement === 'off' ? undefined : args.requirement,
            },
        })
        return null
    },
})

async function setRequirement(
    ctx: ActionCtx,
    broadcasterId: string,
    requirement: SubRequirement
): Promise<SetResult> {
    const current = await ctx.runQuery(internal.subRequirement.forChannel, {
        broadcasterId,
    })
    if (!current) return { kind: 'unlinked' }

    // Turning it off needs nothing from Twitch, so it always works.
    if (requirement !== 'off') {
        if (current.needsReconnect) return { kind: 'needs_reconnect' }
        try {
            if (!(await twitchClient().canHaveSubs(broadcasterId))) {
                return { kind: 'not_eligible' }
            }
        } catch (error) {
            console.error('Error checking a Twitch channel', error)
            return { kind: 'check_failed' }
        }
    }

    await ctx.runMutation(internal.subRequirement.save, {
        broadcasterId,
        requirement,
    })
    return { kind: 'ok' }
}

export const set = action({
    args: { requirement: subRequirementSetting },
    returns: setResult,
    handler: async (ctx, args): Promise<SetResult> => {
        const identity = await ctx.auth.getUserIdentity()
        if (!identity) throw new Error('Not signed in')
        const broadcasterId: string | null = await ctx.runQuery(
            internal.subRequirement.channelForOwner,
            { ownerId: identity.subject }
        )
        if (!broadcasterId) return { kind: 'unlinked' }
        return await setRequirement(ctx, broadcasterId, args.requirement)
    },
})

// Adapters check Twitch Admin status before calling.
export const setForChannel = internalAction({
    args: { broadcasterId: v.string(), requirement: subRequirementSetting },
    returns: setResult,
    handler: async (ctx, args): Promise<SetResult> =>
        await setRequirement(ctx, args.broadcasterId, args.requirement),
})
