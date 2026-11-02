import { internal } from '@nxt/backend/api'
import type { ActionCtx } from '@nxt/backend/server'
import { tryCatch } from '@nxt/utils'

import type { DiscordClient } from './discordClient'

export type DiscordLinkResult =
    | { ok: true }
    | {
          ok: false
          reason: 'invalid_state' | 'cancelled' | 'exchange_failed' | 'taken'
      }

/**
 * Complete a Discord link from the bot-install redirect's query. The `state`
 * is consumed first, so it is good once whatever happens next. The guild
 * linked is the one Discord reports in the code exchange; the redirect's
 * `guild_id` is never trusted. Any failure leaves the Community's Platform
 * Links as they were.
 */
export async function completeDiscordLink(
    ctx: ActionCtx,
    client: DiscordClient,
    query: { state?: string; code?: string; error?: string }
): Promise<DiscordLinkResult> {
    if (!query.state) return { ok: false, reason: 'invalid_state' }
    const linkState = await ctx.runMutation(
        internal.platformLinks.consumeDiscordState,
        { state: query.state }
    )
    if (!linkState.ok) return { ok: false, reason: 'invalid_state' }
    if (query.error || !query.code) return { ok: false, reason: 'cancelled' }

    const exchanged = await tryCatch(client.exchangeBotInstallCode(query.code))
    if (exchanged.error) {
        console.error('Error exchanging Discord code', exchanged.error)
        return { ok: false, reason: 'exchange_failed' }
    }

    const saved = await ctx.runMutation(internal.platformLinks.linkDiscordGuild, {
        communityId: linkState.communityId,
        guildId: exchanged.data.guildId,
    })
    if (!saved.ok) return { ok: false, reason: saved.reason }
    return { ok: true }
}
