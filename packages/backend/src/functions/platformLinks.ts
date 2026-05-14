import { api } from '@nxt/backend/api'
import type { Id } from '@nxt/backend/dataModel'
import { query, internalMutation } from '@nxt/backend/server'
import { v } from 'convex/values'

type PlatformLink = {
	enabled: boolean
	platform: string
	platformName: string
	platformId: string
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
			}
		})

		return result
	},
})

export const createPlatformLink = internalMutation({
	args: {
		communityId: v.string(),
		platform: v.union(
			v.literal('discord'),
			v.literal('twitch'),
			v.literal('youtube')
		),
		platformId: v.string(),
		accessToken: v.optional(v.string()),
		refreshToken: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		switch (args.platform) {
			case 'discord':
				await ctx.db.insert('platformLinks', {
					platform: 'discord',
					platformId: args.platformId,
					platformName: 'Discord',
					communityId: args.communityId as Id<'communities'>,
					enabled: true,
				})
				break
			default:
				throw new Error(`Unsupported platform: ${args.platform}`)
		}
	},
})
