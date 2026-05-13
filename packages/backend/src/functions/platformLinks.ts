import { internal } from '@nxt/backend/api'
import { query } from '@nxt/backend/server'
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
		const ownerCommunity = await ctx.runQuery(
			internal.communities.getCommunity,
			{
				ownerId: args.ownerId,
			}
		)

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
