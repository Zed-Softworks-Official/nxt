import { api } from '@nxt/backend/api'
import { query, internalMutation } from '@nxt/backend/server'
import { v } from 'convex/values'

import { consumedLinkState, consumeLinkState } from '../model/linkState'

type PlatformLink = {
	enabled: boolean
	platform: string
	platformName: string
	platformId: string
	// The linked channel's display name (Twitch only).
	channelName?: string
}

export const getPlatformLinks = query({
	args: {
		ownerId: v.string(),
	},
	handler: async (ctx, args): Promise<PlatformLink[]> => {
		const ownerCommunity = await ctx.runQuery(api.communities.getCommunity, {
			ownerId: args.ownerId,
		})

		if (!ownerCommunity) {
			throw new Error('Owner not found')
		}

		const platformLinks = await ctx.db
			.query('platformLinks')
			.withIndex('byCommunity', (q) => q.eq('communityId', ownerCommunity._id))
			.collect()

		const result = platformLinks.map((platformLink) => {
			return {
				enabled: platformLink.enabled,
				platform: platformLink.platform,
				platformName: platformLink.platformName,
				platformId: platformLink.platformId,
				...(platformLink.twitch
					? { channelName: platformLink.twitch.displayName }
					: {}),
			}
		})

		return result
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
