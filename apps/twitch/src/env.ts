import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
    server: {
        CONVEX_URL: z.string(),
        CONVEX_DEPLOY_KEY: z.string(),
        TWITCH_CLIENT_ID: z.string(),
        TWITCH_CLIENT_SECRET: z.string(),
        // The Nxt bot account's user ID. The bot account must have authorized
        // this app with user:read:chat, user:write:chat and user:bot once; after
        // that, reading and replying use the app access token (ADR-0003).
        TWITCH_BOT_USER_ID: z.string(),
        // Public hostname (behind an HTTPS reverse proxy) EventSub posts
        // webhooks to, the port the listener binds, and the secret Twitch signs
        // them with (10–100 chars).
        TWITCH_EVENTSUB_HOSTNAME: z.string(),
        TWITCH_EVENTSUB_SECRET: z.string().min(10).max(100),
        TWITCH_EVENTSUB_PORT: z.coerce.number().default(8080),
    },
    runtimeEnv: {
        CONVEX_URL:
            process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL,
        CONVEX_DEPLOY_KEY: process.env.CONVEX_DEPLOY_KEY,
        TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
        TWITCH_BOT_USER_ID: process.env.TWITCH_BOT_USER_ID,
        TWITCH_EVENTSUB_HOSTNAME: process.env.TWITCH_EVENTSUB_HOSTNAME,
        TWITCH_EVENTSUB_SECRET: process.env.TWITCH_EVENTSUB_SECRET,
        TWITCH_EVENTSUB_PORT: process.env.TWITCH_EVENTSUB_PORT,
    },
    emptyStringAsUndefined: true,
})
