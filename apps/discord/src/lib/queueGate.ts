import { api, internal } from '@nxt/backend/api'
import type { Id } from '@nxt/backend/dataModel'
import { type CommandInteraction, PermissionFlagsBits } from 'discord.js'

import type { QueueConvex } from '~/lib/convex'

export type QueueCommandKind = 'player' | 'admin'

type QueueReply = string | { content: string; ephemeral?: boolean }

export async function editDeferred(
    interaction: CommandInteraction,
    message: QueueReply
): Promise<void> {
    const content = typeof message === 'string' ? message : message.content
    const wantsPrivate =
        typeof message !== 'string' && message.ephemeral === true
    // Ephemeral is fixed at defer time. A private result after a public
    // defer replaces that placeholder with a private follow-up.
    if (wantsPrivate && interaction.ephemeral !== true) {
        await interaction.deleteReply()
        await interaction.followUp({ content, ephemeral: true })
        return
    }

    await interaction.editReply(content)
}

export async function runQueueCommand(
    interaction: CommandInteraction,
    client: QueueConvex,
    command: {
        kind: QueueCommandKind
        ephemeral?: boolean
        run: (ctx: {
            guildId: string
            communityId: Id<'communities'>
        }) => Promise<void>
    }
): Promise<void> {
    if (!interaction.guildId) {
        await interaction.reply('This command can only be used in a server.')
        return
    }

    if (
        command.kind === 'admin' &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
        await interaction.reply('You need Manage Server to do that.')
        return
    }

    await interaction.deferReply(
        command.ephemeral ? { ephemeral: true } : undefined
    )

    const link = await client.query(api.discordGuild.getLinkedCommunity, {
        guildId: interaction.guildId,
    })
    if (!link) {
        await editDeferred(
            interaction,
            "This server isn't connected to a community."
        )
        return
    }

    if (
        command.kind === 'player' &&
        link.commandChannelId !== null &&
        interaction.channelId !== link.commandChannelId
    ) {
        await editDeferred(interaction, {
            content: `Queue commands go in <#${link.commandChannelId}>.`,
            ephemeral: true,
        })
        return
    }

    await client.mutation(internal.queue.ensureQueueForCommunity, {
        communityId: link.communityId,
    })

    await command.run({
        guildId: interaction.guildId,
        communityId: link.communityId,
    })
}
