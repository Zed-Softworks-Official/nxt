import { internalMutation } from '@nxt/backend/server'
import { v } from 'convex/values'

export const setCommandChannel = internalMutation({
	args: {
		guildId: v.string(),
		channelId: v.string(),
	},
	returns: v.union(v.literal('set'), v.literal('already')),
	handler: async (ctx, args) => {
		const link = await ctx.db
			.query('platformLinks')
			.withIndex('byPlatform', (q) =>
				q.eq('platform', 'discord').eq('platformId', args.guildId),
			)
			.first()
		if (!link) throw new Error('Community not found')
		if (link.commandChannelId === args.channelId) return 'already' as const

		await ctx.db.patch('platformLinks', link._id, {
			commandChannelId: args.channelId,
		})
		return 'set' as const
	},
})
