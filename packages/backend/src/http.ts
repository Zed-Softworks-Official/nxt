import { ActionCtx } from '@nxt/backend/server'

import { Hono } from 'hono'
import { HonoWithConvex, HttpRouterWithHono } from 'convex-helpers/server/hono'

const app: HonoWithConvex<ActionCtx> = new Hono()

app.get('/clerk', (ctx) => {
	return ctx.json({ ok: true })
})

export default new HttpRouterWithHono(app)
