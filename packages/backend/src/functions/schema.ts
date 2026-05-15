import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
	communities: defineTable({
		name: v.string(),
		ownerId: v.string(),
	}).index('byOwner', ['ownerId']),
	platformLinks: defineTable({
		communityId: v.id('communities'),
		enabled: v.boolean(),
		platform: v.union(
			v.literal('discord'),
			v.literal('twitch'),
			v.literal('youtube')
		),
		platformId: v.string(),
		platformName: v.string(),
		accessToken: v.optional(v.string()),
		refreshToken: v.optional(v.string()),
	})
		.index('byCommunity', ['communityId'])
		.index('byPlatform', ['platform', 'platformId']),
	queues: defineTable({
		communityId: v.id('communities'),
		state: v.union(v.literal('open'), v.literal('paused')),
	}).index('byCommunity', ['communityId']),
	participants: defineTable({
		queueId: v.id('queues'),
		username: v.string(),
		platform: v.union(
			v.literal('discord'),
			v.literal('twitch'),
			v.literal('youtube')
		),
		platformUserId: v.string(),
		status: v.union(
			v.literal('waiting'),
			v.literal('notified'),
			v.literal('playing'),
			v.literal('done')
		),
	})
		.index('byQueue', ['queueId'])
		.index('byUser', ['platformUserId', 'platform', 'queueId']),
})
