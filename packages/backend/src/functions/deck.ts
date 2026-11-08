import { type MutationCtx, mutation, query } from '@nxt/backend/server'
import { v } from 'convex/values'

import * as Deck from '../model/deck'
import { markPairedDeckUsed, resolvePairedDeck } from '../model/pairedDeck'
import * as Queue from '../model/queue'

// Deck functions for a Paired deck (ADR-0006). They authorize with the deck's
// secret, never `ctx.auth`, and take the Community from the Paired deck,
// never from an argument. A revoked or unknown secret gets `unpaired`.

/** The deck view. Reads the Paired deck row, so revoking ends the subscription. */
export const view = query({
    args: { secret: v.string() },
    returns: Deck.viewResult,
    handler: async (ctx, args) => {
        const paired = await resolvePairedDeck(ctx, args.secret)
        if (!paired) return { kind: 'unpaired' as const }
        return await Deck.view(ctx, paired.community._id)
    },
})

// Resolve the deck's Queue for a deck mutation and record the use. Null for a
// revoked or unknown secret. Reads never touch last used, so a live
// subscription doesn't write constantly.
async function deckQueue(ctx: MutationCtx, secret: string) {
    const paired = await resolvePairedDeck(ctx, secret)
    if (!paired) return null
    await markPairedDeckUsed(ctx, paired.deck, Date.now())
    return await Queue.ensureQueue(ctx, paired.community._id)
}

const unpaired = { kind: 'unpaired' as const }

const stateResult = v.union(Queue.stateResult, Deck.unpaired)

/** Open the Queue for joins. */
export const open = mutation({
    args: { secret: v.string() },
    returns: stateResult,
    handler: async (ctx, args) => {
        const queue = await deckQueue(ctx, args.secret)
        if (!queue) return unpaired
        return await Queue.open(ctx, queue)
    },
})

/** Pause the Queue: nobody new can join. */
export const pause = mutation({
    args: { secret: v.string() },
    returns: stateResult,
    handler: async (ctx, args) => {
        const queue = await deckQueue(ctx, args.secret)
        if (!queue) return unpaired
        return await Queue.pause(ctx, queue)
    },
})

/**
 * Quick Ping the front `count` waiting Participants (clamped to 1–10) with
 * the Saved ping note.
 */
export const ping = mutation({
    args: { secret: v.string(), count: v.number() },
    returns: v.union(Queue.pingResult, Deck.unpaired),
    handler: async (ctx, args) => {
        const queue = await deckQueue(ctx, args.secret)
        if (!queue) return unpaired
        return await Queue.ping(ctx, queue, Deck.clampPingCount(args.count))
    },
})

const turnArgs = { secret: v.string(), reference: v.number() }
const turnResult = v.union(Queue.turnResult, Deck.unpaired)

/** Pinged → Playing, for the Participant the slot key was showing. */
export const play = mutation({
    args: turnArgs,
    returns: turnResult,
    handler: async (ctx, args) => {
        const queue = await deckQueue(ctx, args.secret)
        if (!queue) return unpaired
        return await Queue.play(ctx, queue, args.reference)
    },
})

/** Pinged → back in the Queue in their original spot. */
export const returnToQueue = mutation({
    args: turnArgs,
    returns: turnResult,
    handler: async (ctx, args) => {
        const queue = await deckQueue(ctx, args.secret)
        if (!queue) return unpaired
        return await Queue.returnToQueue(ctx, queue, args.reference)
    },
})

/** Playing → finished. */
export const done = mutation({
    args: turnArgs,
    returns: turnResult,
    handler: async (ctx, args) => {
        const queue = await deckQueue(ctx, args.secret)
        if (!queue) return unpaired
        return await Queue.done(ctx, queue, args.reference)
    },
})
