import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

process.env.CONVEX_URL ??= 'https://test.convex.cloud'
process.env.DISCORD_TOKEN ??= 'test-token'
process.env.DISCORD_CLIENT_ID ??= 'test-client'

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
