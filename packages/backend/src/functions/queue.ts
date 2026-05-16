import { query } from '@nxt/backend/server'
import { v } from 'convex/values'

export const getParticipants = query({
	args: {
		ownerId: v.string(),
	},
	handler: async (ctx, args) => {
		const community = await ctx.db
			.query('communities')
			.withIndex('byOwner', (q) => q.eq('ownerId', args.ownerId))
			.first()
		if (!community) throw new Error('Community not found')

		const queue = await ctx.db
			.query('queues')
			.withIndex('byCommunity', (q) => q.eq('communityId', community._id))
			.first()
		if (!queue) throw new Error('Queue not found')

		const participants = await ctx.db
			.query('participants')
			.withIndex('byQueue', (q) => q.eq('queueId', queue._id))
			.collect()

		return participants
	},
})

