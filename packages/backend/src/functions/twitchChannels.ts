import { internalQuery } from '@nxt/backend/server'
import { v } from 'convex/values'

// The broadcaster user IDs of every enabled Twitch Platform Link. The Twitch
// adapter listens for chat in exactly these channels.
export const linked = internalQuery({
    args: {},
    returns: v.array(v.string()),
    handler: async (ctx) => {
        const links = await ctx.db
            .query('platformLinks')
            .withIndex('byPlatform', (q) => q.eq('platform', 'twitch'))
            .collect()
        return links
            .filter((link) => link.enabled)
            .map((link) => link.platformId)
    },
})
