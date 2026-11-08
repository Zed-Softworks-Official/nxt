import { internal } from '@nxt/backend/api'
import type { ActionCtx } from '@nxt/backend/server'
import { tryCatch } from '@nxt/utils'

import type { TwitchClient } from './twitchClient'

// The scope a broadcaster grants so the Nxt bot account may read and post in
// their chat with an app access token (ADR-0003).
export const BROADCASTER_SCOPE = 'channel:bot'

// The scope that lets Nxt check a chatter's sub tier for the Sub requirement
// (ADR-0006).
export const BROADCASTER_SUBSCRIPTIONS_SCOPE = 'channel:read:subscriptions'

export type TwitchLinkResult =
    | { ok: true }
    | {
          ok: false
          reason:
              | 'invalid_state'
              | 'cancelled'
              | 'exchange_failed'
              | 'not_broadcaster_grant'
              | 'taken'
              | 'wrong_channel'
              | 'subscribe_failed'
      }

/**
 * Complete a Twitch link from the OAuth callback's query. The `state` is
 * consumed first, so it is good once whatever happens next. The channel
 * linked is the one whose broadcaster signed in. Any failure leaves the
 * Community's Platform Links as they were.
 */
export async function completeTwitchLink(
    ctx: ActionCtx,
    client: TwitchClient,
    query: { state?: string; code?: string; error?: string }
): Promise<TwitchLinkResult> {
    if (!query.state) return { ok: false, reason: 'invalid_state' }
    const linkState = await ctx.runMutation(internal.twitchLink.consumeState, {
        state: query.state,
    })
    if (!linkState.ok) return { ok: false, reason: 'invalid_state' }
    if (query.error || !query.code) return { ok: false, reason: 'cancelled' }

    const code = query.code
    const signIn = await tryCatch(
        (async () => {
            const grant = await client.exchangeCode(code)
            const user = await client.getUser(grant.accessToken)
            return { grant, user }
        })()
    )
    if (signIn.error) {
        console.error('Error completing Twitch sign-in', signIn.error)
        return { ok: false, reason: 'exchange_failed' }
    }
    const { grant, user } = signIn.data

    // Only a broadcaster's own consent lets the bot into the channel. A grant
    // without the scopes (trimmed, or an unrelated sign-in) is not a
    // broadcaster grant.
    if (
        !grant.scopes.includes(BROADCASTER_SCOPE) ||
        !grant.scopes.includes(BROADCASTER_SUBSCRIPTIONS_SCOPE)
    ) {
        return { ok: false, reason: 'not_broadcaster_grant' }
    }

    const taken = await ctx.runQuery(internal.twitchLink.linkedElsewhere, {
        communityId: linkState.communityId,
        broadcasterId: user.id,
    })
    if (taken) return { ok: false, reason: 'taken' }

    // A Community has one Twitch channel, so while it is linked a sign-in can
    // only be that channel's Reconnect.
    const linkedChannel = await ctx.runQuery(
        internal.twitchLink.linkedChannel,
        {
            communityId: linkState.communityId,
        }
    )
    if (linkedChannel && linkedChannel !== user.id) {
        return { ok: false, reason: 'wrong_channel' }
    }

    const subscribed = await tryCatch(client.subscribeToChat(user.id))
    if (subscribed.error) {
        console.error('Error subscribing to Twitch chat', subscribed.error)
        return { ok: false, reason: 'subscribe_failed' }
    }

    const saved = await ctx.runMutation(internal.twitchLink.saveLink, {
        communityId: linkState.communityId,
        broadcaster: user,
        grant,
        subscriptionId: subscribed.data,
    })
    if (!saved.ok) {
        // Linked elsewhere between the check and the save. The subscription
        // belongs to that other link now, so leave it in place.
        return { ok: false, reason: 'taken' }
    }
    return { ok: true }
}
