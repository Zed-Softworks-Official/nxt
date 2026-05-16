import { mutation, query } from '@nxt/backend/server'
import { v } from 'convex/values'

// Helper: resolve ownerId → community → queue
async function resolveQueue(ctx: any, ownerId: string) {
	const community = await ctx.db
		.query('communities')
		.withIndex('byOwner', (q: any) => q.eq('ownerId', ownerId))
		.first()
	if (!community) throw new Error('Community not found')

	const queue = await ctx.db
		.query('queues')
		.withIndex('byCommunity', (q: any) => q.eq('communityId', community._id))
		.first()
	if (!queue) throw new Error('Queue not found')

	return queue
}

// Helper: write a single event to the activity log
async function logEvent(
	ctx: any,
	participant: {
		queueId: any
		username: string
		platform: 'discord' | 'twitch' | 'youtube'
		platformUserId: string
	},
	event: 'pinged' | 'returned_to_queue' | 'finished'
) {
	await ctx.db.insert('activityLog', {
		queueId: participant.queueId,
		username: participant.username,
		platform: participant.platform,
		platformUserId: participant.platformUserId,
		event,
	})
}

export const getParticipants = query({
	args: {
		ownerId: v.string(),
	},
	handler: async (ctx, args) => {
		const queue = await resolveQueue(ctx, args.ownerId)

		const all = await ctx.db
			.query('participants')
			.withIndex('byQueue', (q: any) => q.eq('queueId', queue._id))
			.collect()

		// Sort all by creation time ascending (join order)
		all.sort(
			(a: { _creationTime: number }, b: { _creationTime: number }) =>
				a._creationTime - b._creationTime
		)

		return {
			queueState: queue.state as 'open' | 'paused',
			waiting: all.filter(
				(p: { status: string }) => p.status === 'waiting'
			),
			notified: all.filter(
				(p: { status: string }) => p.status === 'notified'
			),
			playing: all.filter(
				(p: { status: string }) => p.status === 'playing'
			),
		}
	},
})

// Ping the next `count` waiting participants (move waiting → notified)
export const pingParticipants = mutation({
	args: {
		ownerId: v.string(),
		count: v.number(),
	},
	handler: async (ctx, args) => {
		const queue = await resolveQueue(ctx, args.ownerId)

		const waiting = await ctx.db
			.query('participants')
			.withIndex('byQueue', (q: any) => q.eq('queueId', queue._id))
			.collect()

		const toNotify = waiting
			.filter((p: { status: string }) => p.status === 'waiting')
			.sort(
				(a: { _creationTime: number }, b: { _creationTime: number }) =>
					a._creationTime - b._creationTime
			)
			.slice(0, args.count)

		for (const participant of toNotify) {
			await ctx.db.patch(participant._id, { status: 'notified' })
			await logEvent(ctx, participant, 'pinged')
		}
	},
})

// Move a notified participant to playing
export const moveToPlaying = mutation({
	args: {
		participantId: v.id('participants'),
	},
	handler: async (ctx, args) => {
		const participant = await ctx.db.get(args.participantId)
		if (!participant) throw new Error('Participant not found')
		if (participant.status !== 'notified')
			throw new Error('Participant is not in notified state')

		await ctx.db.patch(args.participantId, { status: 'playing' })
	},
})

// Move a notified participant back to waiting — logs the no-show event
export const moveBackToQueue = mutation({
	args: {
		participantId: v.id('participants'),
	},
	handler: async (ctx, args) => {
		const participant = await ctx.db.get(args.participantId)
		if (!participant) throw new Error('Participant not found')
		if (participant.status !== 'notified')
			throw new Error('Participant is not in notified state')

		await ctx.db.patch(args.participantId, { status: 'waiting' })
		await logEvent(ctx, participant, 'returned_to_queue')
	},
})

// Mark a playing participant as done — logs the finished event and removes from participants
export const markDone = mutation({
	args: {
		participantId: v.id('participants'),
	},
	handler: async (ctx, args) => {
		const participant = await ctx.db.get(args.participantId)
		if (!participant) throw new Error('Participant not found')
		if (participant.status !== 'playing')
			throw new Error('Participant is not currently playing')

		await logEvent(ctx, participant, 'finished')
		await ctx.db.delete(args.participantId)
	},
})

// Toggle queue state between open and paused
export const toggleQueueState = mutation({
	args: {
		ownerId: v.string(),
	},
	handler: async (ctx, args) => {
		const queue = await resolveQueue(ctx, args.ownerId)
		const newState = queue.state === 'open' ? 'paused' : 'open'
		await ctx.db.patch(queue._id, { state: newState })
	},
})

// Get the activity log for a queue, most recent first
export const getActivityLog = query({
	args: {
		ownerId: v.string(),
	},
	handler: async (ctx, args) => {
		const queue = await resolveQueue(ctx, args.ownerId)

		const entries = await ctx.db
			.query('activityLog')
			.withIndex('byQueue', (q: any) => q.eq('queueId', queue._id))
			.collect()

		// Most recent event first
		entries.sort(
			(a: { _creationTime: number }, b: { _creationTime: number }) =>
				b._creationTime - a._creationTime
		)

		return entries
	},
})
