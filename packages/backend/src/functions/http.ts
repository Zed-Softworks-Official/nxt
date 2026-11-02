import type { ActionCtx } from '@nxt/backend/server'
import { internal } from '@nxt/backend/api'
import { tryCatch } from '@nxt/utils'

import type { WebhookEvent } from '@clerk/backend'
import { Webhook } from 'svix'

import { Hono } from 'hono'
import { HonoWithConvex, HttpRouterWithHono } from 'convex-helpers/server/hono'

import { env } from '../env'
import { discordClient } from '../model/discordClient'
import { completeDiscordLink } from '../model/discordLink'
import { twitchClient } from '../model/twitchClient'
import { completeTwitchLink } from '../model/twitchLink'

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

// Discord redirects the owner here after the bot install started from the
// dashboard. The guild comes from the code exchange, never the query.
app.get('/discord', async (ctx) => {
	const { state, code, error } = ctx.req.query()
	const result = await completeDiscordLink(ctx.env, discordClient(), {
		state,
		code,
		error,
	})
	if (!result.ok) {
		console.warn('Discord link refused: ', result.reason)
		return ctx.redirect(connectionsUrl({ type: 'error', reason: result.reason }))
	}

	return ctx.redirect(connectionsUrl({ type: 'success' }))
})

// Twitch redirects the broadcaster here after the OAuth sign-in started from
// the dashboard (ADR-0002).
app.get('/twitch', async (ctx) => {
	const { state, code, error } = ctx.req.query()
	const result = await completeTwitchLink(ctx.env, twitchClient(), {
		state,
		code,
		error,
	})
	if (!result.ok) {
		console.warn('Twitch link refused: ', result.reason)
		return ctx.redirect(connectionsUrl({ type: 'error', reason: result.reason }))
	}

	return ctx.redirect(connectionsUrl({ type: 'success' }))
})

// The dashboard's connections page, where link callbacks report the outcome.
function connectionsUrl(params: Record<string, string>) {
	const url = new URL('/dashboard/connections', env.DASHBOARD_URL)
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value)
	}
	return url.toString()
}

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
