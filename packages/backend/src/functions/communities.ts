import { internalMutation, query } from '@nxt/backend/server'
import { v } from 'convex/values'

import { insertPausedQueue } from '../model/pausedQueue'

export const createCommunity = internalMutation({
	args: {
		name: v.string(),
		clerkId: v.string(),
	},
	handler: async (ctx, args) => {
		const doesExistForUser = await ctx.db
			.query('communities')
			.filter((q) => q.eq(q.field('ownerId'), args.clerkId))
			.first()

		if (doesExistForUser) {
			console.log('User already has a community')
			return
		}

		const communityId = await ctx.db.insert('communities', {
			name: args.name,
			ownerId: args.clerkId,
		})
		await insertPausedQueue(ctx, communityId)
	},
})

export const getCommunity = query({
	args: {
		ownerId: v.string(),
	},
	handler: async (ctx, args) => {
		const community = await ctx.db
			.query('communities')
			.withIndex('byOwner', (q) => q.eq('ownerId', args.ownerId))
			.first()

		return community
	},
})
