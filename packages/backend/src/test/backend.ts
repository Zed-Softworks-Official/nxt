import { convexTest } from 'convex-test'
import schema from '../functions/schema'

const modules = import.meta.glob('../functions/**/*.*s')

export function createTestBackend() {
    return convexTest(schema, modules)
}

export type TestBackend = ReturnType<typeof createTestBackend>

export async function seedCommunity(backend: TestBackend, ownerId: string) {
    return await backend.run(async (ctx) => {
        return await ctx.db.insert('communities', {
            name: 'Community',
            ownerId,
        })
    })
}

export async function readPlatformLinks(backend: TestBackend, ownerId: string) {
    return await backend.run(async (ctx) => {
        const community = await ctx.db
            .query('communities')
            .withIndex('byOwner', (q) => q.eq('ownerId', ownerId))
            .first()
        if (!community) return null

        const links = await ctx.db
            .query('platformLinks')
            .withIndex('byCommunity', (q) => q.eq('communityId', community._id))
            .collect()
        return links.map((link) => ({
            platform: link.platform,
            platformId: link.platformId,
            enabled: link.enabled,
        }))
    })
}
