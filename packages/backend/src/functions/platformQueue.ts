import { internal } from '@nxt/backend/api'
import {
    internalAction,
    internalMutation,
    internalQuery,
    type MutationCtx,
} from '@nxt/backend/server'
import { v } from 'convex/values'

import * as Queue from '../model/queue'
import { twitchClient } from '../model/twitchClient'
import { withBroadcasterGrant } from '../model/twitchGrant'
import type { SubRequirement } from '../subRequirement'

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
        // A Twitch Admin, exempt from the Sub requirement.
        exempt: v.optional(v.boolean()),
        // The person's sub tier, once looked up. 0 for no sub.
        subTier: v.optional(v.number()),
    },
    returns: v.union(Queue.joinResult, Queue.unlinked),
    handler: async (ctx, args) => {
        const link = await Queue.enabledLink(ctx, args.link)
        if (!link) return unlinked
        return await onLinkedQueue(ctx, args.link, (queue) =>
            Queue.join(
                ctx,
                queue,
                {
                    platform: args.link.platform,
                    platformUserId: args.platformUserId,
                    username: args.username,
                    login: args.login,
                    channelId: args.channelId,
                },
                link,
                { exempt: args.exempt, tier: args.subTier }
            )
        )
    },
})

type TwitchJoinResult =
    | { kind: 'ok' | 'already'; reference: number }
    | { kind: 'paused' | 'joins_off' | 'unlinked' | 'sub_check_failed' }
    | {
          kind: 'sub_required'
          requirement: Exclude<SubRequirement, 'off'>
      }

// A Twitch join. The first pass settles everything that needs no Twitch call
// (already waiting, Paused, Joins off, exempt), so only a join that would
// otherwise succeed spends one on the subscriptions API (ADR-0006). The second
// pass rechecks everything, because the Queue may have changed in between.
export const joinTwitch = internalAction({
    args: {
        broadcasterId: v.string(),
        platformUserId: v.string(),
        username: v.string(),
        login: v.string(),
        exempt: v.boolean(),
    },
    handler: async (ctx, args): Promise<TwitchJoinResult> => {
        const join = {
            link: {
                platform: 'twitch' as const,
                platformId: args.broadcasterId,
            },
            platformUserId: args.platformUserId,
            username: args.username,
            login: args.login,
        }
        const first = await ctx.runMutation(internal.platformQueue.join, {
            ...join,
            exempt: args.exempt,
        })
        if (first.kind !== 'sub_check_needed') return first

        const client = twitchClient()
        const checked = await withBroadcasterGrant(
            ctx,
            client,
            args.broadcasterId,
            (accessToken) =>
                client.getSubscriberTier(
                    args.broadcasterId,
                    args.platformUserId,
                    accessToken
                )
        )
        if (!checked.ok) return { kind: 'sub_check_failed' }

        const second = await ctx.runMutation(internal.platformQueue.join, {
            ...join,
            subTier: checked.value ?? 0,
        })
        // A tier was supplied, so a second lookup is never asked for.
        if (second.kind === 'sub_check_needed') {
            return { kind: 'sub_check_failed' }
        }
        return second
    },
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
    args: {
        link: Queue.platformLink,
        count: v.number(),
        note: v.optional(v.string()),
    },
    returns: v.union(Queue.pingResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) =>
            Queue.ping(ctx, queue, args.count, args.note)
        ),
})

// A targeted Ping (ADR-0007): calls one waiting Participant by reference.
export const pingOne = internalMutation({
    args: {
        link: Queue.platformLink,
        reference: v.number(),
        note: v.optional(v.string()),
    },
    returns: v.union(Queue.targetedPingResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) =>
            Queue.pingOne(ctx, queue, args.reference, args.note)
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

export const remove = internalMutation({
    args: turnArgs,
    returns: v.union(Queue.removeResult, Queue.unlinked),
    handler: async (ctx, args) =>
        onLinkedQueue(ctx, args.link, (queue) =>
            Queue.remove(ctx, queue, args.reference)
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
