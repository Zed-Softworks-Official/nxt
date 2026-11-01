import {
    createTestBackend,
    readActivityLog,
    readQueue,
    seedCommunity,
    seedDiscordCommunity,
    type TestBackend,
} from '@nxt/backend/testing'
import { type CommandInteraction, PermissionFlagsBits } from 'discord.js'
import type { QueueConvex } from '~/lib/convex'

// The backend harness is shared with every platform adapter; this file adds
// only the Discord-specific fakes.
export {
    createTestBackend,
    readActivityLog,
    readQueue,
    seedCommunity,
    seedDiscordCommunity,
}

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
    options?: Record<string, string | number>
}) {
    const replies: SeenReply[] = []
    const manageServer = input.manageServer === true
    const interaction = {
        guildId: input.guildId ?? null,
        channelId: input.channelId ?? 'channel-1',
        ephemeral: null as boolean | null,
        deferred: false,
        replied: false,
        user: {
            id: input.userId ?? 'user-1',
            username: input.username ?? 'ada',
        },
        isChatInputCommand: () => true,
        options: {
            getString: (name: string) => {
                const value = input.options?.[name]
                return typeof value === 'string' ? value : null
            },
            getInteger: (name: string) => {
                const value = input.options?.[name]
                return typeof value === 'number' ? value : null
            },
        },
        memberPermissions: {
            has: (permission: bigint) =>
                manageServer && permission === PermissionFlagsBits.ManageGuild,
        },
        deferReply: async (options?: { ephemeral?: boolean }) => {
            interaction.deferred = true
            interaction.ephemeral = options?.ephemeral === true
        },
        editReply: async (message: string | { content?: string }) => {
            interaction.replied = true
            const content =
                typeof message === 'string' ? message : (message.content ?? '')
            replies.push({
                content,
                ephemeral: interaction.ephemeral === true,
            })
        },
        deleteReply: async () => undefined,
        followUp: async (
            message: string | { content?: string; ephemeral?: boolean }
        ) => {
            interaction.replied = true
            if (typeof message === 'string') {
                replies.push({ content: message, ephemeral: false })
                return
            }
            replies.push({
                content: message.content ?? '',
                ephemeral: message.ephemeral === true,
            })
        },
        reply: async (
            message: string | { content?: string; ephemeral?: boolean }
        ) => {
            interaction.replied = true
            if (typeof message === 'string') {
                replies.push({ content: message, ephemeral: false })
                return
            }
            interaction.ephemeral = message.ephemeral === true
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
