import { internalMutation, mutation, query } from '@nxt/backend/server'
import { v } from 'convex/values'

import { ownedCommunity, requireOwnedCommunity } from '../model/community'
import { insertPausedQueue } from '../model/pausedQueue'
import { parsePingNote } from '../pingNote'

export const createCommunity = internalMutation({
    args: {
        name: v.string(),
        clerkId: v.string(),
    },
    handler: async (ctx, args) => {
        const doesExistForUser = await ctx.db
            .query('communities')
            .filter((q) => q.eq(q.field('ownerId'), args.clerkId))
            .first()

        if (doesExistForUser) {
            console.log('User already has a community')
            return
        }

        const communityId = await ctx.db.insert('communities', {
            name: args.name,
            ownerId: args.clerkId,
        })
        await insertPausedQueue(ctx, communityId)
    },
})

export const getCommunity = query({
    args: {
        ownerId: v.string(),
    },
    handler: async (ctx, args) => {
        const community = await ctx.db
            .query('communities')
            .withIndex('byOwner', (q) => q.eq('ownerId', args.ownerId))
            .first()

        return community
    },
})

// The owner's Saved ping note. Null when signed out or none is saved.
export const savedPingNote = query({
    args: {},
    returns: v.union(v.string(), v.null()),
    handler: async (ctx) => {
        const community = await ownedCommunity(ctx)
        return community?.savedPingNote ?? null
    },
})

export const setSavedPingNote = mutation({
    args: { note: v.string() },
    returns: v.union(
        v.object({
            kind: v.literal('ok'),
            note: v.union(v.string(), v.null()),
        }),
        v.object({ kind: v.literal('note_too_long'), max: v.number() })
    ),
    handler: async (ctx, args) => {
        const community = await requireOwnedCommunity(ctx)
        const parsed = parsePingNote(args.note)
        if (parsed.kind === 'note_too_long') return parsed
        await ctx.db.patch('communities', community._id, {
            savedPingNote: parsed.note ?? undefined,
        })
        return parsed
    },
})
