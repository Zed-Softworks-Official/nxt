import type { MutationCtx, QueryCtx } from '@nxt/backend/server'

/** The Community `ownerId` owns, or null. */
export async function communityForOwner(
    ctx: QueryCtx | MutationCtx,
    ownerId: string
) {
    return await ctx.db
        .query('communities')
        .withIndex('byOwner', (q) => q.eq('ownerId', ownerId))
        .first()
}

/** The signed-in owner's Community. Null when signed out or ownerless. */
export async function ownedCommunity(ctx: QueryCtx | MutationCtx) {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    return await communityForOwner(ctx, identity.subject)
}

/** The signed-in owner's Community. Throws when signed out or ownerless. */
export async function requireOwnedCommunity(ctx: QueryCtx | MutationCtx) {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const community = await communityForOwner(ctx, identity.subject)
    if (!community) throw new Error('Community not found')
    return community
}
