import { query } from '@nxt/backend/server'
import { v } from 'convex/values'

export const getLinkedCommunity = query({
	args: {
		guildId: v.string(),
	},
	returns: v.union(
		v.object({
			communityId: v.id('communities'),
			commandChannelId: v.union(v.string(), v.null()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const link = await ctx.db
			.query('platformLinks')
			.withIndex('byPlatform', (q) =>
				q.eq('platform', 'discord').eq('platformId', args.guildId),
			)
			.first()
		if (!link) return null

		return {
			communityId: link.communityId,
			commandChannelId: link.commandChannelId ?? null,
		}
	},
})
