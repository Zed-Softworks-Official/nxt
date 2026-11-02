import {
    internalMutation,
    internalQuery,
    type MutationCtx,
} from '@nxt/backend/server'
import { v } from 'convex/values'

import * as Queue from '../model/queue'

// Queue operations for platform adapters (Discord, Twitch). Each takes the
// Platform Link the command came from. Adapters do their own Admin checks
// before calling, so these are internal: callable only with the deploy key,
// never from a browser. A missing or disabled Platform Link returns `unlinked`.

const unlinked = { kind: 'unlinked' as const }

// Run `operation` on the Queue behind `link`, or answer `unlinked`.
async function onLinkedQueue<T>(
    ctx: MutationCtx,
    link: Queue.PlatformLinkRef,
    operation: (queue: Queue.QueueDoc) => Promise<T>
): Promise<T | typeof unlinked> {
    const queue = await Queue.requireQueueForLink(ctx, link)
    if (!queue) return unlinked
    return await operation(queue)
}

export const join = internalMutation({
    args: {
        link: Queue.platformLink,
        platformUserId: v.string(),
        username: v.string(),
        // The login to @mention, where it differs from the display name.
        login: v.optional(v.string()),
        // The channel the command ran in, kept as the Announcement fallback.
        channelId: v.optional(v.string()),
    },
    returns: v.union(Queue.joinResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) =>
            Queue.join(ctx, queue, {
                platform: args.link.platform,
                platformUserId: args.platformUserId,
                username: args.username,
                login: args.login,
                channelId: args.channelId,
            })
        ),
})

export const leave = internalMutation({
    args: {
        link: Queue.platformLink,
        platformUserId: v.string(),
    },
    returns: v.union(Queue.leaveResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) =>
            Queue.leave(ctx, queue, {
                platform: args.link.platform,
                platformUserId: args.platformUserId,
            })
        ),
})

export const open = internalMutation({
    args: { link: Queue.platformLink },
    returns: v.union(Queue.stateResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) => Queue.open(ctx, queue)),
})

export const pause = internalMutation({
    args: { link: Queue.platformLink },
    returns: v.union(Queue.stateResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) => Queue.pause(ctx, queue)),
})

export const clear = internalMutation({
    args: { link: Queue.platformLink },
    returns: v.union(Queue.clearResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) => Queue.clear(ctx, queue)),
})

export const ping = internalMutation({
    args: { link: Queue.platformLink, count: v.number() },
    returns: v.union(Queue.pingResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) =>
            Queue.ping(ctx, queue, args.count)
        ),
})

const turnArgs = { link: Queue.platformLink, reference: v.number() }

export const play = internalMutation({
    args: turnArgs,
    returns: v.union(Queue.turnResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) =>
            Queue.play(ctx, queue, args.reference)
        ),
})

export const returnToQueue = internalMutation({
    args: turnArgs,
    returns: v.union(Queue.turnResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) =>
            Queue.returnToQueue(ctx, queue, args.reference)
        ),
})

export const done = internalMutation({
    args: turnArgs,
    returns: v.union(Queue.turnResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) =>
            Queue.done(ctx, queue, args.reference)
        ),
})

export const position = internalQuery({
    args: { link: Queue.platformLink, platformUserId: v.string() },
    returns: v.union(Queue.positionResult, Queue.unlinked),
    handler: async (ctx, args) => {
        const found = await Queue.queueForLink(ctx, args.link)
        if (!found) return unlinked
        return await Queue.position(ctx, found.queue, {
            platform: args.link.platform,
            platformUserId: args.platformUserId,
        })
    },
})

export const view = internalQuery({
    args: { link: Queue.platformLink },
    returns: v.union(Queue.viewResult, Queue.unlinked),
    handler: async (ctx, args) => {
        const found = await Queue.queueForLink(ctx, args.link)
        if (!found) return unlinked
        return await Queue.view(ctx, found.queue)
    },
})
