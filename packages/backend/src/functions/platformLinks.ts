import { query, internalMutation } from '@nxt/backend/server'
import { v } from 'convex/values'

import { ownedCommunity } from '../model/community'
import { consumedLinkState, consumeLinkState } from '../model/linkState'

const platformLink = v.object({
    enabled: v.boolean(),
    platform: v.union(
        v.literal('discord'),
        v.literal('twitch'),
        v.literal('youtube')
    ),
    platformName: v.string(),
    platformId: v.string(),
    // The linked channel's display name (Twitch only).
    channelName: v.optional(v.string()),
})

// The signed-in owner's Platform Links. Empty when signed out.
export const getPlatformLinks = query({
    args: {},
    returns: v.array(platformLink),
    handler: async (ctx) => {
        const community = await ownedCommunity(ctx)
        if (!community) return []

        const platformLinks = await ctx.db
            .query('platformLinks')
            .withIndex('byCommunity', (q) => q.eq('communityId', community._id))
            .collect()

        return platformLinks.map((platformLink) => ({
            enabled: platformLink.enabled,
            platform: platformLink.platform,
            platformName: platformLink.platformName,
            platformId: platformLink.platformId,
            ...(platformLink.twitch
                ? { channelName: platformLink.twitch.displayName }
                : {}),
        }))
    },
})

/** Consume a Discord link `state`. Good once; see model/linkState.ts. */
export const consumeDiscordState = internalMutation({
    args: { state: v.string() },
    returns: consumedLinkState,
    handler: async (ctx, args) => {
        return await consumeLinkState(ctx, {
            platform: 'discord',
            token: args.state,
        })
    },
})

/**
 * Save the Discord Platform Link for a guild the bot was installed in. The
 * guild's single row is created, or re-enabled and moved to this Community
 * if it was unlinked. Refused if another Community has it enabled.
 */
export const linkDiscordGuild = internalMutation({
    args: {
        communityId: v.id('communities'),
        guildId: v.string(),
    },
    returns: v.union(
        v.object({ ok: v.literal(true) }),
        v.object({ ok: v.literal(false), reason: v.literal('taken') })
    ),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query('platformLinks')
            .withIndex('byPlatform', (q) =>
                q.eq('platform', 'discord').eq('platformId', args.guildId)
            )
            .first()
        if (existing?.enabled && existing.communityId !== args.communityId) {
            return { ok: false as const, reason: 'taken' as const }
        }

        if (existing) {
            await ctx.db.patch('platformLinks', existing._id, {
                communityId: args.communityId,
                enabled: true,
            })
        } else {
            await ctx.db.insert('platformLinks', {
                platform: 'discord',
                platformId: args.guildId,
                platformName: 'Discord',
                communityId: args.communityId,
                enabled: true,
            })
        }
        return { ok: true as const }
    },
})
