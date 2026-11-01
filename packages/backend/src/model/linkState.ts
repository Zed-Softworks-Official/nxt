import type { Doc, Id } from '@nxt/backend/dataModel'
import type { MutationCtx } from '@nxt/backend/server'

import { env } from '../env'

export type LinkPlatform = Doc<'linkStates'>['platform']

/** How long a minted link state stays valid. */
export const LINK_STATE_TTL_MS = 10 * 60 * 1000

/**
 * Mint a single-use, signed, short-lived `state` token for a platform's link
 * flow, tied to the Community owner who starts it.
 *
 * The token is `<linkStateId>.<signature>`. The signature is an HMAC over the
 * row ID, the platform, and the expiry, keyed by `LINK_STATE_SECRET`.
 */
export async function mintLinkState(
    ctx: MutationCtx,
    input: {
        communityId: Id<'communities'>
        ownerId: string
        platform: LinkPlatform
    }
): Promise<string> {
    const expiresAt = Date.now() + LINK_STATE_TTL_MS
    const id = await ctx.db.insert('linkStates', {
        communityId: input.communityId,
        ownerId: input.ownerId,
        platform: input.platform,
        expiresAt,
    })
    const signature = await sign(signedPayload(id, input.platform, expiresAt))
    return `${id}.${signature}`
}

export type ConsumedLinkState =
    | { ok: true; communityId: Id<'communities'>; ownerId: string }
    | { ok: false; reason: 'invalid' | 'expired' }

/**
 * Verify and consume a `state` token for `platform`. A token is good once: a
 * valid, unexpired token is deleted as it is consumed, and an expired one is
 * deleted as it is refused. Forged, reused, or wrong-platform tokens are
 * refused as `invalid` and change nothing.
 */
export async function consumeLinkState(
    ctx: MutationCtx,
    input: { platform: LinkPlatform; token: string }
): Promise<ConsumedLinkState> {
    const [rawId, signature, ...rest] = input.token.split('.')
    if (!rawId || !signature || rest.length > 0)
        return { ok: false, reason: 'invalid' }

    const id = ctx.db.normalizeId('linkStates', rawId)
    if (!id) return { ok: false, reason: 'invalid' }

    const linkState = await ctx.db.get(id)
    if (!linkState || linkState.platform !== input.platform) {
        return { ok: false, reason: 'invalid' }
    }

    const expected = await sign(
        signedPayload(id, linkState.platform, linkState.expiresAt)
    )
    if (!constantTimeEqual(signature, expected)) {
        return { ok: false, reason: 'invalid' }
    }

    await ctx.db.delete(id)
    if (linkState.expiresAt <= Date.now()) {
        return { ok: false, reason: 'expired' }
    }

    return {
        ok: true,
        communityId: linkState.communityId,
        ownerId: linkState.ownerId,
    }
}

function signedPayload(
    id: Id<'linkStates'>,
    platform: LinkPlatform,
    expiresAt: number
) {
    return `${id}:${platform}:${expiresAt}`
}

async function sign(payload: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(env.LINK_STATE_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    return base64Url(new Uint8Array(mac))
}

function base64Url(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}
