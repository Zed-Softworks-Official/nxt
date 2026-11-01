import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
	activityLog: defineTable({
		queueId: v.id('queues'),
		username: v.string(),
		platform: v.union(
			v.literal('discord'),
			v.literal('twitch'),
			v.literal('youtube')
		),
		platformUserId: v.string(),
		// What happened to this player
		event: v.union(
			v.literal('pinged'),           // moved waiting → notified
			v.literal('returned_to_queue'), // moved notified → waiting (no-show)
			v.literal('finished')          // session completed
		),
	}).index('byQueue', ['queueId']),
	communities: defineTable({
		name: v.string(),
		ownerId: v.string(),
		// The last Participant reference handed out. Only ever increases.
		lastReference: v.optional(v.number()),
	}).index('byOwner', ['ownerId']),
	// Single-use, short-lived link states minted by a Community owner when they
	// start linking a platform. See model/linkState.ts.
	linkStates: defineTable({
		communityId: v.id('communities'),
		ownerId: v.string(),
		platform: v.union(
			v.literal('discord'),
			v.literal('twitch'),
			v.literal('youtube')
		),
		expiresAt: v.number(),
	}),
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
		commandChannelId: v.optional(v.string()),
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
		// Participant reference, shown as `q-<reference>`. Unique per Community.
		reference: v.number(),
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
		.index('byQueueAndReference', ['queueId', 'reference'])
		.index('byUser', ['platformUserId', 'platform', 'queueId']),
})
