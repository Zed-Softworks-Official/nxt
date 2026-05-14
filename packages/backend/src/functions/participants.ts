import { mutation } from '@nxt/backend/server'
import { v } from 'convex/values'

export const addParticipant = mutation({
	args: {
		platform: v.union(
			v.literal('discord'),
			v.literal('twitch'),
			v.literal('youtube')
		),
		platofrmId: v.string(),
		platformUserId: v.string(),
	},
	handler: async (ctx, args) => {
		return null
	},
})
