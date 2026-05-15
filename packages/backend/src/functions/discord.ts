import { mutation } from '@nxt/backend/server'
import { v } from 'convex/values'

export const joinQ = mutation({
	args: {
		username: v.string(),
		platformUserId: v.string(),
		platformId: v.string(),
	},
	handler: async (ctx, args) => {
		// Get the Community from the platform ID
		const community = await ctx.db
			.query('platformLinks')
			.withIndex('byPlatform', (q) =>
				q.eq('platform', 'discord').eq('platformId', args.platformId)
			)
			.first()
		if (!community) throw new Error('Community not found')

		// Get the Queue ID from the community ID
		const queue = await ctx.db
			.query('queues')
			.withIndex('byCommunity', (q) =>
				q.eq('communityId', community.communityId)
			)
			.first()
		if (!queue) throw new Error('Queue not found')

		// Check if the queue is open
		if (queue.state !== 'open') throw new Error('Queue is not open')

		// Check if the user is already in the queue
		const participant = await ctx.db
			.query('participants')
			.withIndex('byUser', (q) => q.eq('platformUserId', args.platformUserId))
			.first()
		if (participant) throw new Error('User is already in the queue')

		// Add the user to the queue (participants table)
		await ctx.db.insert('participants', {
			queueId: queue._id,
			username: args.username,
			platform: 'discord',
			platformUserId: args.platformUserId,
			status: 'waiting',
		})
	},
})

export const leaveQ = mutation({
	args: {
		platformUserId: v.string(),
		platformId: v.string(),
	},
	handler: async (ctx, args) => {
		// Get the Community from the platform ID
		const community = await ctx.db
			.query('platformLinks')
			.withIndex('byPlatform', (q) =>
				q.eq('platform', 'discord').eq('platformId', args.platformId)
			)
			.first()
		if (!community) throw new Error('Community not found')

		// Get the Queue ID from the community ID
		const queue = await ctx.db
			.query('queues')
			.withIndex('byCommunity', (q) =>
				q.eq('communityId', community.communityId)
			)
			.first()
		if (!queue) throw new Error('Queue not found')

		// Check if the queue is open
		if (queue.state !== 'open') throw new Error('Queue is not open')

		// Check if the user is already in the queue
		const participant = await ctx.db
			.query('participants')
			.withIndex('byUser', (q) => q.eq('platformUserId', args.platformUserId))
			.first()
		if (!participant) throw new Error('User is not in the queue')

		await ctx.db.delete('participants', participant._id)
	},
})
