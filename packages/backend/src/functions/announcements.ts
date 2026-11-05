import { internal } from '@nxt/backend/api'
import { internalMutation, internalQuery } from '@nxt/backend/server'
import { v } from 'convex/values'

import * as Announcement from '../model/announcement'
import { platform } from '../model/queue'

// The Announcement outbox for platform adapters (ADR-0004). Internal: only
// adapters holding the deploy key may read or settle Announcements.

// Pending Announcements for one platform, oldest first. Adapters subscribe to
// this, post every `post` entry, and mark every `drop` entry dropped.
export const pending = internalQuery({
    args: { platform },
    returns: v.array(Announcement.pendingAnnouncement),
    handler: async (ctx, args) =>
        await Announcement.pending(ctx, args.platform),
})

export const markDelivered = internalMutation({
    args: { id: v.id('announcements') },
    returns: v.null(),
    handler: async (ctx, args) => {
        await Announcement.settle(ctx, args.id, 'delivered')
        return null
    },
})

export const markDropped = internalMutation({
    args: { id: v.id('announcements') },
    returns: v.null(),
    handler: async (ctx, args) => {
        await Announcement.settle(ctx, args.id, 'dropped')
        return null
    },
})

// Drops overdue pending Announcements and deletes settled ones past the
// retention window. Runs from crons.ts and reschedules itself while a full
// batch was handled.
export const prune = internalMutation({
    args: {},
    returns: v.object({ pruned: v.number() }),
    handler: async (ctx) => {
        const { pruned, more } = await Announcement.prune(ctx, Date.now())
        if (more) {
            await ctx.scheduler.runAfter(0, internal.announcements.prune, {})
        }
        return { pruned }
    },
})
