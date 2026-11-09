import {
    internalMutation,
    type MutationCtx,
    mutation,
    type QueryCtx,
    query,
} from '@nxt/backend/server'
import { v } from 'convex/values'
import { ownedCommunity, requireOwnedCommunity } from '../model/community'
import { queueForCommunity } from '../model/pausedQueue'
import * as Queue from '../model/queue'
import schema from './schema'

// Queue operations for the dashboard. The caller is the Community owner,
// identified by their Clerk session, never by an argument.

async function requireOwnedQueue(ctx: MutationCtx) {
    const community = await requireOwnedCommunity(ctx)
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

// A targeted Ping (ADR-0007): calls one waiting Participant by reference.
export const pingOne = mutation({
    args: { reference: v.number(), note: v.optional(v.string()) },
    returns: Queue.targetedPingResult,
    handler: async (ctx, args) =>
        Queue.pingOne(
            ctx,
            await requireOwnedQueue(ctx),
            args.reference,
            args.note
        ),
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

export const remove = mutation({
    args: { reference: v.number() },
    returns: Queue.removeResult,
    handler: async (ctx, args) =>
        Queue.remove(ctx, await requireOwnedQueue(ctx), args.reference),
})

// How many Activity log entries the dashboard shows.
const ACTIVITY_LOG_LIMIT = 50

// The owner's latest Activity log entries, most recent first. Empty when
// signed out.
export const getActivityLog = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id('activityLog'),
            _creationTime: v.number(),
            ...schema.tables.activityLog.validator.fields,
        })
    ),
    handler: async (ctx) => {
        const owned = await ownedQueueForRead(ctx)
        if (!owned?.queue) return []
        const queueId = owned.queue._id

        return await ctx.db
            .query('activityLog')
            .withIndex('byQueue', (q) => q.eq('queueId', queueId))
            .order('desc')
            .take(ACTIVITY_LOG_LIMIT)
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
