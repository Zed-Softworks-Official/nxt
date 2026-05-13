import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
	server: {
		CLERK_WEBHOOK_SECRET: z.string(),
        CLERK_ISSUER_URL: z.string(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
})
