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
            .withIndex('byPlatformAndEnabled', (q) =>
                q.eq('platform', 'twitch').eq('enabled', true)
            )
            .collect()
        return links.map((link) => link.platformId)
    },
})
