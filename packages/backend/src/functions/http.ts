import type { ActionCtx } from '@nxt/backend/server'
import { internal } from '@nxt/backend/api'
import { tryCatch } from '@nxt/utils'

import type { WebhookEvent } from '@clerk/backend'
import { Webhook } from 'svix'

import { Hono } from 'hono'
import { HonoWithConvex, HttpRouterWithHono } from 'convex-helpers/server/hono'

import { env } from '~/env'

const app: HonoWithConvex<ActionCtx> = new Hono()

app.post('/clerk', async (ctx) => {
	const { data: event, error } = await tryCatch(
		clerkValidateRequest(ctx.req.raw)
	)

	if (error) {
		console.error('Error Validating Clerk Webhook: ', error)
		return ctx.json({ error: error.message }, 400)
	}

	switch (event.type) {
		case 'user.created':
			await ctx.env.runMutation(internal.communities.createCommunity, {
				name: event.data.username ?? 'Username',
				clerkId: event.data.id,
			})
			break
		default:
			console.warn('Unhandled Clerk Webhook Event: ', event.type)
			break
	}

	return ctx.json({ message: 'Webhook Received' })
})

app.get('/discord', async (ctx) => {
	const { state: communityId, guild_id: platformId } = ctx.req.query()
	if (!communityId || !platformId)
		return ctx.redirect('localhost:3000/dashboard/connections/error')

	await ctx.env.runMutation(internal.platformLinks.createPlatformLink, {
		communityId,
		platform: 'discord',
		platformId,
	})

	return ctx.redirect('localhost:3000/dashboard/connections/success')
})

async function clerkValidateRequest(req: Request) {
	const payloadString = await req.text()
	const svixHeaders = {
		'svix-id': req.headers.get('svix-id'),
		'svix-timestamp': req.headers.get('svix-timestamp'),
		'svix-signature': req.headers.get('svix-signature'),
	} as Record<string, string>

	if (
		!svixHeaders['svix-id'] ||
		!svixHeaders['svix-timestamp'] ||
		!svixHeaders['svix-signature']
	) {
		throw new Error('Missing SVIX headers')
	}

	const wh = new Webhook(env.CLERK_WEBHOOK_SECRET)
	const data = wh.verify(payloadString, svixHeaders) as WebhookEvent

	return data
}

export default new HttpRouterWithHono(app)
