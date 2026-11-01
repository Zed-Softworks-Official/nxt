import { mutation } from '@nxt/backend/server'
import { v } from 'convex/values'

import { mintLinkState as mint } from '../model/linkState'

/**
 * Mint the `state` value for a platform link flow. Only the signed-in
 * Community owner may call this; the token is tied to their Community.
 */
export const mintLinkState = mutation({
    args: {
        platform: v.union(v.literal('discord'), v.literal('twitch')),
    },
    handler: async (ctx, args): Promise<string> => {
        const identity = await ctx.auth.getUserIdentity()
        if (!identity) throw new Error('Not signed in')

        const community = await ctx.db
            .query('communities')
            .withIndex('byOwner', (q) => q.eq('ownerId', identity.subject))
            .first()
        if (!community) throw new Error('Community not found')

        return await mint(ctx, {
            communityId: community._id,
            ownerId: identity.subject,
            platform: args.platform,
        })
    },
})
