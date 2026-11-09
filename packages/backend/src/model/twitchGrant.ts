import { internal } from '@nxt/backend/api'
import type { ActionCtx } from '@nxt/backend/server'

import { TwitchAuthError, type TwitchClient } from './twitchClient'

export type GrantCallResult<T> =
    | { ok: true; value: T }
    | { ok: false; reason: 'needs_reconnect' | 'unavailable' }

type Grant = { accessToken: string; refreshToken: string; expiresAt: number }

// Refresh this long before the stored expiry.
const EXPIRY_MARGIN_MS = 60_000
// How long to wait for another action's refresh before giving up.
const WAIT_STEP_MS = 100
const WAIT_STEPS = 50

function isUsable(grant: Grant, rejectedToken?: string) {
    return (
        grant.expiresAt > Date.now() + EXPIRY_MARGIN_MS &&
        grant.accessToken !== rejectedToken
    )
}

/**
 * A grant to call Twitch with. Twitch can invalidate a refresh token once it is
 * used, so only the action holding the claim refreshes it. The others wait for
 * the result, which stops a loser of the race reading as a revoked grant.
 */
async function usableGrant(
    ctx: ActionCtx,
    client: TwitchClient,
    broadcasterId: string,
    rejectedToken?: string
): Promise<GrantCallResult<Grant>> {
    for (let step = 0; step < WAIT_STEPS; step += 1) {
        const grant = await ctx.runQuery(internal.twitchLink.grantFor, {
            broadcasterId,
        })
        if (!grant) return { ok: false, reason: 'needs_reconnect' }
        if (isUsable(grant, rejectedToken)) return { ok: true, value: grant }

        const claim = await ctx.runMutation(
            internal.twitchLink.claimGrantRefresh,
            { broadcasterId, refreshToken: grant.refreshToken }
        )
        if (claim === 'claimed') {
            return await refresh(ctx, client, broadcasterId, grant)
        }
        // Someone else has it, or has just finished. Look again shortly.
        if (claim === 'held') {
            await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS))
        }
    }
    return { ok: false, reason: 'unavailable' }
}

async function refresh(
    ctx: ActionCtx,
    client: TwitchClient,
    broadcasterId: string,
    grant: Grant
): Promise<GrantCallResult<Grant>> {
    try {
        const refreshed = await client.refreshGrant(grant.refreshToken)
        await ctx.runMutation(internal.twitchLink.saveRefreshedGrant, {
            broadcasterId,
            previousRefreshToken: grant.refreshToken,
            grant: refreshed,
        })
        return { ok: true, value: refreshed }
    } catch (error) {
        const revoked = error instanceof TwitchAuthError
        console.error('Error refreshing a Twitch grant', error)
        await ctx.runMutation(internal.twitchLink.endGrantRefresh, {
            broadcasterId,
            refreshToken: grant.refreshToken,
            revoked,
        })
        return {
            ok: false,
            reason: revoked ? 'needs_reconnect' : 'unavailable',
        }
    }
}

/**
 * Call Twitch with a broadcaster's access token, refreshing the grant when it
 * has expired or Twitch rejects the token. Every failure comes back as a
 * result, so callers can answer honestly.
 */
export async function withBroadcasterGrant<T>(
    ctx: ActionCtx,
    client: TwitchClient,
    broadcasterId: string,
    call: (accessToken: string) => Promise<T>
): Promise<GrantCallResult<T>> {
    const grant = await usableGrant(ctx, client, broadcasterId)
    if (!grant.ok) return grant
    try {
        return { ok: true, value: await call(grant.value.accessToken) }
    } catch (error) {
        if (!(error instanceof TwitchAuthError)) {
            console.error('Error calling Twitch with a grant', error)
            return { ok: false, reason: 'unavailable' }
        }
    }

    // Twitch rejected the token early. Try once more with a new one.
    const retry = await usableGrant(
        ctx,
        client,
        broadcasterId,
        grant.value.accessToken
    )
    if (!retry.ok) return retry
    try {
        return { ok: true, value: await call(retry.value.accessToken) }
    } catch (error) {
        console.error('Error calling Twitch with a refreshed grant', error)
        return { ok: false, reason: 'unavailable' }
    }
}
