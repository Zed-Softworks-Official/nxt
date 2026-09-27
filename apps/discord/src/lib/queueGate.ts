import { api } from '@nxt/backend/api'
import type { Id } from '@nxt/backend/dataModel'
import { type CommandInteraction, PermissionFlagsBits } from 'discord.js'

import type { QueueConvex } from '~/lib/convex'

export type QueueCommandKind = 'player' | 'admin'

export async function runQueueCommand(
    interaction: CommandInteraction,
    client: QueueConvex,
    command: {
        kind: QueueCommandKind
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

    const link = await client.query(api.discordGuild.getLinkedCommunity, {
        guildId: interaction.guildId,
    })
    if (!link) {
        await interaction.reply("This server isn't connected to a community.")
        return
    }

    if (
        command.kind === 'player' &&
        link.commandChannelId !== null &&
        interaction.channelId !== link.commandChannelId
    ) {
        await interaction.reply({
            content: `Queue commands go in <#${link.commandChannelId}>.`,
            ephemeral: true,
        })
        return
    }

    await client.mutation(api.queue.ensureQueueForCommunity, {
        communityId: link.communityId,
    })

    await command.run({
        guildId: interaction.guildId,
        communityId: link.communityId,
    })
}
