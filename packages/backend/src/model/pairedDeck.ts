import type { Doc, Id } from '@nxt/backend/dataModel'
import type { MutationCtx, QueryCtx } from '@nxt/backend/server'
import { v } from 'convex/values'

import { MAX_DECK_NAME_LENGTH, normalizePairingCode } from '../pairingLink'

// Paired decks and their pairing (ADR-0006). A Stream Deck plugin starts a
// pairing request and shows its code; the Community owner approves the code on
// the dashboard; the plugin polls with its private poll token and collects the
// deck's secret exactly once. Secrets and poll tokens are bearer credentials:
// only their hashes are stored, and they are never logged.

/** How long a pairing code stays approvable. */
export const PAIRING_TTL_MS = 10 * 60 * 1000

// No 0/O or 1/I, so a code read off a key is hard to mistype.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

export const approveResult = v.union(
    v.object({ kind: v.literal('ok') }),
    // No pairing request has this code.
    v.object({ kind: v.literal('unknown') }),
    // The code is past its 10 minutes.
    v.object({ kind: v.literal('expired') }),
    // The code has already been approved.
    v.object({ kind: v.literal('used') }),
    v.object({ kind: v.literal('invalid_name') })
)

export const pollResult = v.union(
    v.object({ kind: v.literal('pending') }),
    v.object({ kind: v.literal('expired') }),
    // Unknown token, or the secret was already handed over.
    v.object({ kind: v.literal('unknown') }),
    v.object({ kind: v.literal('approved'), secret: v.string() })
)

export async function startPairing(ctx: MutationCtx, now: number) {
    let code = randomCode()
    while (await liveRequestForCode(ctx, code, now)) code = randomCode()

    const pollToken = randomToken('nxtp_')
    await ctx.db.insert('pairingRequests', {
        code,
        pollTokenHash: await sha256(pollToken),
        expiresAt: now + PAIRING_TTL_MS,
        status: 'pending',
    })
    return { code, pollToken, expiresAt: now + PAIRING_TTL_MS }
}

export async function approvePairing(
    ctx: MutationCtx,
    input: { communityId: Id<'communities'>; code: string; name: string },
    now: number
) {
    const code = normalizePairingCode(input.code)
    // A code is only reissued once its earlier request expired, so the newest
    // request with it is the one the owner means.
    const request = await ctx.db
        .query('pairingRequests')
        .withIndex('byCode', (q) => q.eq('code', code))
        .order('desc')
        .first()
    if (!request) return { kind: 'unknown' as const }
    if (request.status !== 'pending') return { kind: 'used' as const }
    if (request.expiresAt <= now) return { kind: 'expired' as const }

    const name = input.name.trim()
    if (name.length === 0 || name.length > MAX_DECK_NAME_LENGTH) {
        return { kind: 'invalid_name' as const }
    }

    const pairedDeckId = await ctx.db.insert('pairedDecks', {
        communityId: input.communityId,
        name,
        createdAt: now,
    })
    await ctx.db.patch('pairingRequests', request._id, {
        status: 'approved',
        pairedDeckId,
    })
    return { kind: 'ok' as const }
}

export async function pollPairing(
    ctx: MutationCtx,
    pollToken: string,
    now: number
) {
    const pollTokenHash = await sha256(pollToken)
    const request = await ctx.db
        .query('pairingRequests')
        .withIndex('byPollTokenHash', (q) =>
            q.eq('pollTokenHash', pollTokenHash)
        )
        .unique()
    if (!request || request.status === 'consumed') {
        return { kind: 'unknown' as const }
    }
    if (request.status === 'pending') {
        return request.expiresAt <= now
            ? { kind: 'expired' as const }
            : { kind: 'pending' as const }
    }

    const deck = request.pairedDeckId
        ? await ctx.db.get('pairedDecks', request.pairedDeckId)
        : null
    // Revoked before the plugin collected it: there is nothing to hand over.
    if (!deck || deck.revokedAt !== undefined) {
        await ctx.db.patch('pairingRequests', request._id, {
            status: 'consumed',
        })
        return { kind: 'unknown' as const }
    }

    // Minted here, not at approval, so the plaintext secret is never stored.
    const secret = randomToken('nxtd_')
    await ctx.db.patch('pairedDecks', deck._id, {
        secretHash: await sha256(secret),
    })
    await ctx.db.patch('pairingRequests', request._id, { status: 'consumed' })
    return { kind: 'approved' as const, secret }
}

/**
 * The Community's usable Paired decks. A deck approved but not yet collected
 * by its plugin has no secret, so it can't run the Queue and isn't listed.
 */
export async function list(ctx: QueryCtx, communityId: Id<'communities'>) {
    const decks = await ctx.db
        .query('pairedDecks')
        .withIndex('byCommunity', (q) => q.eq('communityId', communityId))
        .collect()
    return decks
        .filter(
            (deck) =>
                deck.revokedAt === undefined && deck.secretHash !== undefined
        )
        .map((deck) => ({
            id: deck._id,
            name: deck.name,
            createdAt: deck.createdAt,
            lastUsedAt: deck.lastUsedAt ?? null,
        }))
}

export const listResult = v.array(
    v.object({
        id: v.id('pairedDecks'),
        name: v.string(),
        createdAt: v.number(),
        lastUsedAt: v.union(v.number(), v.null()),
    })
)

/**
 * The live (unrevoked) Paired deck a secret belongs to, and its Community.
 * Null for an unknown, uncollected, or revoked secret. Deck functions must
 * authorize through this and take the Community from it, never from an
 * argument (ADR-0006).
 */
export async function resolvePairedDeck(
    ctx: QueryCtx | MutationCtx,
    secret: string
): Promise<{ deck: PairedDeck; community: Doc<'communities'> } | null> {
    if (secret.length === 0) return null
    const secretHash = await sha256(secret)
    const deck = await ctx.db
        .query('pairedDecks')
        .withIndex('bySecretHash', (q) => q.eq('secretHash', secretHash))
        .unique()
    if (!deck || deck.revokedAt !== undefined) return null
    const community = await ctx.db.get('communities', deck.communityId)
    if (!community) return null
    return { deck, community }
}

/** Record that a Paired deck was just used. Call from deck mutations. */
export async function markPairedDeckUsed(
    ctx: MutationCtx,
    deck: PairedDeck,
    now: number
) {
    await ctx.db.patch('pairedDecks', deck._id, { lastUsedAt: now })
}

/** Revoke one of the Community's Paired decks. Takes effect immediately. */
export async function revoke(
    ctx: MutationCtx,
    input: { communityId: Id<'communities'>; id: Id<'pairedDecks'> },
    now: number
) {
    const deck = await ctx.db.get('pairedDecks', input.id)
    if (
        !deck ||
        deck.communityId !== input.communityId ||
        deck.revokedAt !== undefined
    ) {
        return { kind: 'unknown' as const }
    }
    await ctx.db.patch('pairedDecks', deck._id, { revokedAt: now })
    return { kind: 'ok' as const }
}

export const revokeResult = v.union(
    v.object({ kind: v.literal('ok') }),
    v.object({ kind: v.literal('unknown') })
)

/** How long an expired request is kept, so its code is refused as expired. */
const RETENTION_MS = 60 * 60 * 1000
const PRUNE_BATCH = 100

/**
 * Delete pairing requests that expired over an hour ago. A deck approved from
 * one but never collected has no secret and never will, so it goes too.
 */
export async function prune(ctx: MutationCtx, now: number) {
    const requests = await ctx.db
        .query('pairingRequests')
        .withIndex('byExpiresAt', (q) => q.lt('expiresAt', now - RETENTION_MS))
        .take(PRUNE_BATCH)
    for (const request of requests) {
        if (request.status === 'approved' && request.pairedDeckId) {
            const deck = await ctx.db.get('pairedDecks', request.pairedDeckId)
            if (deck && deck.secretHash === undefined) {
                await ctx.db.delete('pairedDecks', deck._id)
            }
        }
        await ctx.db.delete('pairingRequests', request._id)
    }
    return { pruned: requests.length, more: requests.length === PRUNE_BATCH }
}

async function liveRequestForCode(ctx: QueryCtx, code: string, now: number) {
    const requests = await ctx.db
        .query('pairingRequests')
        .withIndex('byCode', (q) => q.eq('code', code))
        .collect()
    return requests.some((request) => request.expiresAt > now)
}

function randomCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
    let code = ''
    for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
    return code
}

/** 32 random bytes, base64url, behind a recognisable prefix. */
function randomToken(prefix: string) {
    return prefix + base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function sha256(value: string) {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value)
    )
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
}

function base64Url(bytes: Uint8Array) {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

export type PairedDeck = Doc<'pairedDecks'>
