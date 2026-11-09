import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

process.env.CONVEX_URL ??= 'https://test.convex.cloud'
process.env.CONVEX_DEPLOY_KEY ||= 'test-deploy-key'
process.env.TWITCH_CLIENT_ID ??= 'test-client'
process.env.TWITCH_CLIENT_SECRET ??= 'test-secret'
process.env.CLERK_WEBHOOK_SECRET ??= 'whsec_test'
process.env.CLERK_ISSUER_URL ??= 'https://clerk.test'
process.env.LINK_STATE_SECRET ??= 'test-link-state-secret'

export default defineConfig({
    resolve: {
        alias: {
            '~': path.resolve(root, 'src'),
        },
    },
    server: {
        fs: {
            allow: [path.resolve(root, '../..')],
        },
    },
    test: {
        environment: 'edge-runtime',
        server: {
            deps: {
                inline: ['convex-test'],
            },
        },
    },
})
