import { mutation } from '@nxt/backend/server'
import { v } from 'convex/values'

import { requireOwnedCommunity } from '../model/community'
import { mintLinkState as mint } from '../model/linkState'

/**
 * Mint the `state` value for a platform link flow. Only the signed-in
 * Community owner may call this; the token is tied to their Community.
 */
export const mintLinkState = mutation({
    args: {
        platform: v.union(v.literal('discord'), v.literal('twitch')),
    },
    returns: v.string(),
    handler: async (ctx, args) => {
        const community = await requireOwnedCommunity(ctx)
        return await mint(ctx, {
            communityId: community._id,
            ownerId: community.ownerId,
            platform: args.platform,
        })
    },
})
