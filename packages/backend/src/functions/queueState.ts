import type { Id } from '@nxt/backend/dataModel'
import { type MutationCtx, mutation } from '@nxt/backend/server'
import { v } from 'convex/values'

import { queueForCommunity } from '../model/pausedQueue'

const openResult = v.union(v.literal('opened'), v.literal('already'))
const pauseResult = v.union(v.literal('paused'), v.literal('already'))

async function requireQueue(
	ctx: MutationCtx,
	communityId: Id<'communities'>,
) {
	const queue = await queueForCommunity(ctx, communityId)
	if (!queue) throw new Error('Queue not found')
	return queue
}

export const openQueue = mutation({
	args: {
		communityId: v.id('communities'),
	},
	returns: openResult,
	handler: async (ctx, args) => {
		const queue = await requireQueue(ctx, args.communityId)
		if (queue.state === 'open') return 'already' as const

		await ctx.db.patch('queues', queue._id, { state: 'open' })
		return 'opened' as const
	},
})

export const pauseQueue = mutation({
	args: {
		communityId: v.id('communities'),
	},
	returns: pauseResult,
	handler: async (ctx, args) => {
		const queue = await requireQueue(ctx, args.communityId)
		if (queue.state === 'paused') return 'already' as const

		await ctx.db.patch('queues', queue._id, { state: 'paused' })
		return 'paused' as const
	},
})
