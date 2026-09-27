import { mutation } from '@nxt/backend/server'
import { v } from 'convex/values'

export const clearWaiting = mutation({
	args: {
		communityId: v.id('communities'),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const queue = await ctx.db
			.query('queues')
			.withIndex('byCommunity', (q) =>
				q.eq('communityId', args.communityId),
			)
			.first()
		if (!queue) throw new Error('Queue not found')

		const participants = await ctx.db
			.query('participants')
			.withIndex('byQueue', (q) => q.eq('queueId', queue._id))
			.collect()

		let cleared = 0
		for (const participant of participants) {
			if (participant.status !== 'waiting') continue
			await ctx.db.delete('participants', participant._id)
			cleared += 1
		}

		return cleared
	},
})
