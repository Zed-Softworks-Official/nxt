/// <reference path="./import-meta.d.ts" />
import { convexTest } from 'convex-test'

import schema from '../functions/schema'

// Vitest-only harness shared by the backend and every platform adapter.
// It runs the real schema and functions in memory through convex-test.
const modules = import.meta.glob('../functions/**/*.*s')

export function createTestBackend() {
    return convexTest(schema, modules)
}

export type TestBackend = ReturnType<typeof createTestBackend>

export type Platform = 'discord' | 'twitch' | 'youtube'

export type ParticipantStatus = 'waiting' | 'notified' | 'playing' | 'done'

export type SeedParticipant = {
    platformUserId: string
    username: string
    status: ParticipantStatus
    platform?: Platform
}

export type SeedPlatformLink = {
    platform: Platform
    platformId: string
    enabled?: boolean
    commandChannelId?: string
}

// Seed a Community, its Queue (unless state is 'none') and its Platform Links.
// Participants get references 1, 2, 3… in the order given, and the counter is
// left at the last one, as if they had joined in that order.
export async function seedCommunity(
    backend: TestBackend,
    input: {
        ownerId: string
        state: 'open' | 'paused' | 'none'
        links?: SeedPlatformLink[]
        participants?: SeedParticipant[]
    }
) {
    return await backend.run(async (ctx) => {
        const participants = input.participants ?? []
        const communityId = await ctx.db.insert('communities', {
            name: 'Community',
            ownerId: input.ownerId,
            ...(participants.length > 0
                ? { lastReference: participants.length }
                : {}),
        })

        if (input.state !== 'none') {
            const queueId = await ctx.db.insert('queues', {
                communityId,
                state: input.state,
            })
            let reference = 0
            for (const participant of participants) {
                reference += 1
                await ctx.db.insert('participants', {
                    queueId,
                    reference,
                    username: participant.username,
                    platform: participant.platform ?? 'discord',
                    platformUserId: participant.platformUserId,
                    status: participant.status,
                })
            }
        }

        for (const link of input.links ?? []) {
            await ctx.db.insert('platformLinks', {
                communityId,
                enabled: link.enabled ?? true,
                platform: link.platform,
                platformId: link.platformId,
                platformName: platformName(link.platform),
                ...(link.commandChannelId
                    ? { commandChannelId: link.commandChannelId }
                    : {}),
            })
        }

        return communityId
    })
}

export async function seedDiscordCommunity(
    backend: TestBackend,
    input: {
        ownerId: string
        guildId: string
        state: 'open' | 'paused' | 'none'
        commandChannelId?: string
        participants?: SeedParticipant[]
    }
) {
    return await seedCommunity(backend, {
        ownerId: input.ownerId,
        state: input.state,
        participants: input.participants,
        links: [
            {
                platform: 'discord',
                platformId: input.guildId,
                commandChannelId: input.commandChannelId,
            },
        ],
    })
}

// A Community linked to one Twitch channel. The broadcaster's user ID is the
// Platform Link's platformId. Participants default to the Twitch platform.
export async function seedTwitchCommunity(
    backend: TestBackend,
    input: {
        ownerId: string
        broadcasterId: string
        state: 'open' | 'paused' | 'none'
        enabled?: boolean
        participants?: SeedParticipant[]
    }
) {
    return await seedCommunity(backend, {
        ownerId: input.ownerId,
        state: input.state,
        participants: input.participants?.map((participant) => ({
            ...participant,
            platform: participant.platform ?? 'twitch',
        })),
        links: [
            {
                platform: 'twitch',
                platformId: input.broadcasterId,
                enabled: input.enabled,
            },
        ],
    })
}

// The Community's Queue as an outsider sees it: state plus every Participant
// in join order, with their Participant reference number.
export async function readQueue(backend: TestBackend, ownerId: string) {
    return await backend.run(async (ctx) => {
        const community = await ctx.db
            .query('communities')
            .withIndex('byOwner', (q) => q.eq('ownerId', ownerId))
            .first()
        if (!community) return null

        const queue = await ctx.db
            .query('queues')
            .withIndex('byCommunity', (q) => q.eq('communityId', community._id))
            .first()
        if (!queue) {
            return { state: null, participants: [] }
        }

        const participants = await ctx.db
            .query('participants')
            .withIndex('byQueue', (q) => q.eq('queueId', queue._id))
            .collect()
        participants.sort((a, b) => a._creationTime - b._creationTime)

        return {
            state: queue.state,
            participants: participants.map((participant) => ({
                reference: participant.reference,
                username: participant.username,
                platform: participant.platform,
                platformUserId: participant.platformUserId,
                status: participant.status,
            })),
        }
    })
}

// The Community's Activity log, oldest first.
export async function readActivityLog(backend: TestBackend, ownerId: string) {
    return await backend.run(async (ctx) => {
        const community = await ctx.db
            .query('communities')
            .withIndex('byOwner', (q) => q.eq('ownerId', ownerId))
            .first()
        if (!community) return []
        const queue = await ctx.db
            .query('queues')
            .withIndex('byCommunity', (q) => q.eq('communityId', community._id))
            .first()
        if (!queue) return []

        const entries = await ctx.db
            .query('activityLog')
            .withIndex('byQueue', (q) => q.eq('queueId', queue._id))
            .collect()
        entries.sort((a, b) => a._creationTime - b._creationTime)
        return entries.map((entry) => ({
            event: entry.event,
            username: entry.username,
            platform: entry.platform,
            platformUserId: entry.platformUserId,
        }))
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

function platformName(platform: Platform) {
    switch (platform) {
        case 'discord':
            return 'Discord'
        case 'twitch':
            return 'Twitch'
        case 'youtube':
            return 'YouTube'
    }
}
