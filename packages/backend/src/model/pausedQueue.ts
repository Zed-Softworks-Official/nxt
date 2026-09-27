import type { Id } from '@nxt/backend/dataModel'
import type { MutationCtx } from '@nxt/backend/server'

export async function insertPausedQueue(
	ctx: MutationCtx,
	communityId: Id<'communities'>,
) {
	return await ctx.db.insert('queues', {
		communityId,
		state: 'paused',
	})
}
