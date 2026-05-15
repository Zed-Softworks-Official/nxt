import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
    server: {
        CONVEX_URL: z.string(),
        DISCORD_TOKEN: z.string(),
        DISCORD_CLIENT_ID: z.string(),
        GUILD_ID: z.optional(z.string()),
    },
    runtimeEnv: {
        CONVEX_URL:
            process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL,
        DISCORD_TOKEN: process.env.DISCORD_TOKEN,
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
        GUILD_ID: process.env.GUILD_ID,
    },
    emptyStringAsUndefined: true,
})
