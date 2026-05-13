import { internalMutation } from '@nxt/backend/server'
import { v } from 'convex/values'

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

		await ctx.db.insert('communities', {
			name: args.name,
			ownerId: args.clerkId,
		})
	},
})
