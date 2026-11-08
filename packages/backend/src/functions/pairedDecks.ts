import { internal } from '@nxt/backend/api'
import { internalMutation, mutation, query } from '@nxt/backend/server'
import { v } from 'convex/values'

import { ownedCommunity, requireOwnedCommunity } from '../model/community'
import * as PairedDeck from '../model/pairedDeck'

// Pairing and managing Paired decks (ADR-0006). Pairing is started and polled
// by the unauthenticated Stream Deck plugin; approval and management belong to
// the signed-in Community owner, whose Community is never an argument.

/** Start a pairing request. Returns the code to show and a private poll token. */
export const startPairing = mutation({
    args: {},
    returns: v.object({
        code: v.string(),
        pollToken: v.string(),
        expiresAt: v.number(),
    }),
    handler: async (ctx) => PairedDeck.startPairing(ctx, Date.now()),
})

/** Approve a pairing code as the signed-in owner, creating a Paired deck. */
export const approvePairing = mutation({
    args: { code: v.string(), name: v.string() },
    returns: PairedDeck.approveResult,
    handler: async (ctx, args) => {
        const community = await requireOwnedCommunity(ctx)
        return await PairedDeck.approvePairing(
            ctx,
            { communityId: community._id, code: args.code, name: args.name },
            Date.now()
        )
    },
})

/** Poll a pairing request. The secret is returned exactly once. */
export const pollPairing = mutation({
    args: { pollToken: v.string() },
    returns: PairedDeck.pollResult,
    handler: async (ctx, args) =>
        PairedDeck.pollPairing(ctx, args.pollToken, Date.now()),
})

/** The signed-in owner's Paired decks: name and last used. Empty when signed out. */
export const list = query({
    args: {},
    returns: PairedDeck.listResult,
    handler: async (ctx) => {
        const community = await ownedCommunity(ctx)
        if (!community) return []
        return await PairedDeck.list(ctx, community._id)
    },
})

/** Revoke one of the signed-in owner's Paired decks. */
export const revoke = mutation({
    args: { id: v.id('pairedDecks') },
    returns: PairedDeck.revokeResult,
    handler: async (ctx, args) => {
        const community = await requireOwnedCommunity(ctx)
        return await PairedDeck.revoke(
            ctx,
            { communityId: community._id, id: args.id },
            Date.now()
        )
    },
})

/** Cron: forget long-expired pairing requests. */
export const prune = internalMutation({
    args: {},
    returns: v.object({ pruned: v.number() }),
    handler: async (ctx) => {
        const { pruned, more } = await PairedDeck.prune(ctx, Date.now())
        if (more) {
            await ctx.scheduler.runAfter(0, internal.pairedDecks.prune, {})
        }
        return { pruned }
    },
})
