import { convexTest } from 'convex-test'
import { type CommandInteraction, PermissionFlagsBits } from 'discord.js'
import type { QueueConvex } from '~/lib/convex'
import schema from '../../../../packages/backend/src/functions/schema'

const modules = import.meta.glob(
    '../../../../packages/backend/src/functions/**/*.*s'
)

export function createTestBackend() {
    return convexTest(schema, modules)
}

type TestBackend = ReturnType<typeof createTestBackend>

export function asQueueConvex(backend: TestBackend): QueueConvex {
    return backend as unknown as QueueConvex
}

export type SeenReply = {
    content: string
    ephemeral: boolean
}

export function fakeInteraction(input: {
    guildId?: string | null
    channelId?: string | null
    userId?: string
    username?: string
    manageServer?: boolean
}) {
    const replies: SeenReply[] = []
    const manageServer = input.manageServer === true
    const interaction = {
        guildId: input.guildId ?? null,
        channelId: input.channelId ?? 'channel-1',
        user: {
            id: input.userId ?? 'user-1',
            username: input.username ?? 'ada',
        },
        memberPermissions: {
            has: (permission: bigint) =>
                manageServer && permission === PermissionFlagsBits.ManageGuild,
        },
        reply: async (
            message: string | { content?: string; ephemeral?: boolean }
        ) => {
            if (typeof message === 'string') {
                replies.push({ content: message, ephemeral: false })
                return
            }
            replies.push({
                content: message.content ?? '',
                ephemeral: message.ephemeral === true,
            })
        },
    }

    return {
        interaction: interaction as unknown as CommandInteraction,
        replies,
    }
}

type ParticipantStatus = 'waiting' | 'notified' | 'playing' | 'done'

export async function seedDiscordCommunity(
    backend: TestBackend,
    input: {
        ownerId: string
        guildId: string
        state: 'open' | 'paused' | 'none'
        commandChannelId?: string
        participants?: Array<{
            platformUserId: string
            username: string
            status: ParticipantStatus
        }>
    }
) {
    await backend.run(async (ctx) => {
        const communityId = await ctx.db.insert('communities', {
            name: 'Community',
            ownerId: input.ownerId,
        })

        if (input.state !== 'none') {
            const queueId = await ctx.db.insert('queues', {
                communityId,
                state: input.state,
            })
            for (const participant of input.participants ?? []) {
                await ctx.db.insert('participants', {
                    queueId,
                    username: participant.username,
                    platform: 'discord',
                    platformUserId: participant.platformUserId,
                    status: participant.status,
                })
            }
        }

        await ctx.db.insert('platformLinks', {
            communityId,
            enabled: true,
            platform: 'discord',
            platformId: input.guildId,
            platformName: 'Discord',
            ...(input.commandChannelId
                ? { commandChannelId: input.commandChannelId }
                : {}),
        })
    })
}

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
                username: participant.username,
                platform: participant.platform,
                platformUserId: participant.platformUserId,
                status: participant.status,
            })),
        }
    })
}
