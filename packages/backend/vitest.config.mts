import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

process.env.CLERK_WEBHOOK_SECRET ??= 'whsec_test'
process.env.CLERK_ISSUER_URL ??= 'https://clerk.test'
process.env.LINK_STATE_SECRET ??= 'test-link-state-secret'

export default defineConfig({
    resolve: {
        alias: {
            '~': path.resolve(root, 'src'),
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
