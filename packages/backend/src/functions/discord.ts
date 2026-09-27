import type { Id } from '@nxt/backend/dataModel'
import { type MutationCtx, mutation } from '@nxt/backend/server'
import { v } from 'convex/values'

import { queueForCommunity } from '../model/pausedQueue'

const joinResult = v.union(
	v.literal('joined'),
	v.literal('paused'),
	v.literal('already'),
)

const leaveResult = v.union(v.literal('left'), v.literal('absent'))

async function requireDiscordQueue(ctx: MutationCtx, platformId: string) {
	const link = await ctx.db
		.query('platformLinks')
		.withIndex('byPlatform', (q) =>
			q.eq('platform', 'discord').eq('platformId', platformId),
		)
		.first()
	if (!link) throw new Error('Community not found')

	const queue = await queueForCommunity(ctx, link.communityId)
	if (!queue) throw new Error('Queue not found')

	return queue
}

async function participantInQueue(
	ctx: MutationCtx,
	queueId: Id<'queues'>,
	platformUserId: string,
) {
	return await ctx.db
		.query('participants')
		.withIndex('byUser', (q) =>
			q
				.eq('platformUserId', platformUserId)
				.eq('platform', 'discord')
				.eq('queueId', queueId),
		)
		.first()
}

export const joinQ = mutation({
	args: {
		username: v.string(),
		platformUserId: v.string(),
		platformId: v.string(),
	},
	returns: joinResult,
	handler: async (ctx, args) => {
		const queue = await requireDiscordQueue(ctx, args.platformId)
		const participant = await participantInQueue(
			ctx,
			queue._id,
			args.platformUserId,
		)
		if (participant) return 'already' as const
		if (queue.state !== 'open') return 'paused' as const

		await ctx.db.insert('participants', {
			queueId: queue._id,
			username: args.username,
			platform: 'discord',
			platformUserId: args.platformUserId,
			status: 'waiting',
		})
		return 'joined' as const
	},
})

export const leaveQ = mutation({
	args: {
		platformUserId: v.string(),
		platformId: v.string(),
	},
	returns: leaveResult,
	handler: async (ctx, args) => {
		const queue = await requireDiscordQueue(ctx, args.platformId)
		const participant = await participantInQueue(
			ctx,
			queue._id,
			args.platformUserId,
		)
		if (!participant) return 'absent' as const

		await ctx.db.delete('participants', participant._id)
		return 'left' as const
	},
})
