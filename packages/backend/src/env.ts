import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
	server: {
		CLERK_WEBHOOK_SECRET: z.string(),
		CLERK_ISSUER_URL: z.string(),
		LINK_STATE_SECRET: z.string().min(16),
	},
	// Convex functions only ever run on the server.
	isServer: true,
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
})
