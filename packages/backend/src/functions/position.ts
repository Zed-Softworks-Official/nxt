import type { Id } from '@nxt/backend/dataModel'
import { type QueryCtx, query } from '@nxt/backend/server'
import { v } from 'convex/values'

const positionResult = v.union(
	v.object({
		outcome: v.literal('waiting'),
		position: v.number(),
	}),
	v.object({
		outcome: v.literal('pinged'),
	}),
	v.object({
		outcome: v.literal('playing'),
	}),
	v.object({
		outcome: v.literal('absent'),
	}),
)

export const getPosition = query({
	args: {
		communityId: v.id('communities'),
		platformUserId: v.string(),
	},
	returns: positionResult,
	handler: async (ctx, args) => {
		return await readPosition(ctx, args.communityId, args.platformUserId)
	},
})

async function readPosition(
	ctx: QueryCtx,
	communityId: Id<'communities'>,
	platformUserId: string,
) {
	const queue = await ctx.db
		.query('queues')
		.withIndex('byCommunity', (q) => q.eq('communityId', communityId))
		.first()
	if (!queue) return { outcome: 'absent' as const }

	const participant = await ctx.db
		.query('participants')
		.withIndex('byUser', (q) =>
			q
				.eq('platformUserId', platformUserId)
				.eq('platform', 'discord')
				.eq('queueId', queue._id),
		)
		.first()
	if (!participant || participant.status === 'done') {
		return { outcome: 'absent' as const }
	}
	if (participant.status === 'notified') {
		return { outcome: 'pinged' as const }
	}
	if (participant.status === 'playing') {
		return { outcome: 'playing' as const }
	}

	const rows = await ctx.db
		.query('participants')
		.withIndex('byQueue', (q) => q.eq('queueId', queue._id))
		.collect()
	const ahead = rows.filter(
		(row) =>
			row.status === 'waiting' &&
			row._creationTime < participant._creationTime,
	).length
	return { outcome: 'waiting' as const, position: ahead + 1 }
}
