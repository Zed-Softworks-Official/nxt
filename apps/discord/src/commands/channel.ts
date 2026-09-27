import { api } from '@nxt/backend/api'
import {
    ChannelType,
    type CommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js'

import { getConvex, type QueueConvex } from '~/lib/convex'
import { runQueueCommand } from '~/lib/queueGate'
import type { Command } from '~/lib/types'

const data = new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Set the command channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

data.addChannelOption((option) =>
    option
        .setName('channel')
        .setDescription('Text channel for queue commands')
        .setRequired(false)
)

export const channel: Command = {
    data,
    async execute(interaction: CommandInteraction, client?: QueueConvex) {
        const convex = client ?? getConvex()
        await runQueueCommand(interaction, convex, {
            kind: 'admin',
            run: async ({ guildId }) => {
                const target = resolveTarget(interaction)
                if ('reply' in target) {
                    await interaction.reply(target.reply)
                    return
                }

                const result = await convex.mutation(
                    api.commandChannel.setCommandChannel,
                    {
                        guildId,
                        channelId: target.id,
                    }
                )
                const mention = `<#${target.id}>`
                if (result === 'already') {
                    await interaction.reply(
                        `Queue commands already go in ${mention}.`
                    )
                    return
                }

                await interaction.reply(`Queue commands now go in ${mention}.`)
            },
        })
    },
}

function resolveTarget(
    interaction: CommandInteraction
): { id: string } | { reply: string } {
    if (!interaction.isChatInputCommand()) {
        return { reply: 'Pick a text channel.' }
    }

    const selected = interaction.options.getChannel('channel')
    const chosen = selected ?? interaction.channel
    if (!chosen) return { reply: 'Pick a text channel.' }
    if (isThread(chosen.type)) {
        return { reply: 'Pick a text channel, not a thread.' }
    }
    if (chosen.type !== ChannelType.GuildText) {
        return { reply: 'Pick a text channel.' }
    }
    return { id: chosen.id }
}

function isThread(type: ChannelType): boolean {
    return (
        type === ChannelType.PublicThread ||
        type === ChannelType.PrivateThread ||
        type === ChannelType.AnnouncementThread
    )
}
