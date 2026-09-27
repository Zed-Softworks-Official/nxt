import { query } from '@nxt/backend/server'
import { v } from 'convex/values'

import { queueForCommunity } from '../model/pausedQueue'

export const viewQueue = query({
	args: {
		communityId: v.id('communities'),
	},
	returns: v.object({
		state: v.union(v.literal('open'), v.literal('paused')),
		usernames: v.array(v.string()),
	}),
	handler: async (ctx, args) => {
		const queue = await queueForCommunity(ctx, args.communityId)
		if (!queue) throw new Error('Queue not found')

		const participants = await ctx.db
			.query('participants')
			.withIndex('byQueue', (q) => q.eq('queueId', queue._id))
			.collect()

		const usernames = participants
			.filter((participant) => participant.status === 'waiting')
			.sort((a, b) => a._creationTime - b._creationTime)
			.map((participant) => participant.username)

		return {
			state: queue.state,
			usernames,
		}
	},
})
