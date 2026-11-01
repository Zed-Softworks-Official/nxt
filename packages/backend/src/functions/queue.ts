import {
	internalMutation,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from '@nxt/backend/server'
import { v } from 'convex/values'

import * as Queue from '../model/queue'
import { queueForCommunity } from '../model/pausedQueue'

// Queue operations for the dashboard. The caller is the Community owner,
// identified by their Clerk session, never by an argument.

async function ownedCommunity(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity()
	if (!identity) return null
	return await ctx.db
		.query('communities')
		.withIndex('byOwner', (q) => q.eq('ownerId', identity.subject))
		.first()
}

async function requireOwnedQueue(ctx: MutationCtx) {
	const identity = await ctx.auth.getUserIdentity()
	if (!identity) throw new Error('Not signed in')
	const community = await ownedCommunity(ctx)
	if (!community) throw new Error('Community not found')
	return await Queue.ensureQueue(ctx, community._id)
}

async function ownedQueueForRead(ctx: QueryCtx) {
	const community = await ownedCommunity(ctx)
	if (!community) return null
	return { queue: await queueForCommunity(ctx, community._id) }
}

// The owner's Queue, Pinged, and Playing lists. Null when signed out.
export const view = query({
	args: {},
	returns: v.union(Queue.viewResult, v.null()),
	handler: async (ctx) => {
		const owned = await ownedQueueForRead(ctx)
		if (!owned) return null
		return await Queue.view(ctx, owned.queue)
	},
})

export const open = mutation({
	args: {},
	returns: Queue.stateResult,
	handler: async (ctx) => Queue.open(ctx, await requireOwnedQueue(ctx)),
})

export const pause = mutation({
	args: {},
	returns: Queue.stateResult,
	handler: async (ctx) => Queue.pause(ctx, await requireOwnedQueue(ctx)),
})

export const clear = mutation({
	args: {},
	returns: Queue.clearResult,
	handler: async (ctx) => Queue.clear(ctx, await requireOwnedQueue(ctx)),
})

export const ping = mutation({
	args: { count: v.number() },
	returns: Queue.pingResult,
	handler: async (ctx, args) =>
		Queue.ping(ctx, await requireOwnedQueue(ctx), args.count),
})

export const play = mutation({
	args: { reference: v.number() },
	returns: Queue.turnResult,
	handler: async (ctx, args) =>
		Queue.play(ctx, await requireOwnedQueue(ctx), args.reference),
})

export const returnToQueue = mutation({
	args: { reference: v.number() },
	returns: Queue.turnResult,
	handler: async (ctx, args) =>
		Queue.returnToQueue(ctx, await requireOwnedQueue(ctx), args.reference),
})

export const done = mutation({
	args: { reference: v.number() },
	returns: Queue.turnResult,
	handler: async (ctx, args) =>
		Queue.done(ctx, await requireOwnedQueue(ctx), args.reference),
})

// The owner's Activity log, most recent first. Empty when signed out.
export const getActivityLog = query({
	args: {},
	handler: async (ctx) => {
		const owned = await ownedQueueForRead(ctx)
		if (!owned?.queue) return []
		const queueId = owned.queue._id

		const entries = await ctx.db
			.query('activityLog')
			.withIndex('byQueue', (q) => q.eq('queueId', queueId))
			.collect()
		return entries.sort((a, b) => b._creationTime - a._creationTime)
	},
})

// Insert a Paused Queue when this Community has none. An existing Queue is
// left as it is. Trusted servers call this with a deploy key.
export const ensureQueueForCommunity = internalMutation({
	args: {
		communityId: v.id('communities'),
	},
	returns: v.id('queues'),
	handler: async (ctx, args) => {
		const community = await ctx.db.get('communities', args.communityId)
		if (!community) throw new Error('Community not found')
		return (await Queue.ensureQueue(ctx, args.communityId))._id
	},
})
