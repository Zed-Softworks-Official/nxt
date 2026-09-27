import type { Id } from '@nxt/backend/dataModel'
import type { MutationCtx, QueryCtx } from '@nxt/backend/server'

export async function queueForCommunity(
	ctx: QueryCtx | MutationCtx,
	communityId: Id<'communities'>,
) {
	return await ctx.db
		.query('queues')
		.withIndex('byCommunity', (q) => q.eq('communityId', communityId))
		.first()
}

export async function insertPausedQueue(
	ctx: MutationCtx,
	communityId: Id<'communities'>,
) {
	return await ctx.db.insert('queues', {
		communityId,
		state: 'paused',
	})
}
