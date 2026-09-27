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
                const target = await resolveTarget(interaction)
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

type ChannelChoice = {
    id: string
    type: ChannelType
}

async function resolveTarget(
    interaction: CommandInteraction
): Promise<{ id: string } | { reply: string }> {
    if (!interaction.isChatInputCommand()) {
        return { reply: 'Pick a text channel.' }
    }

    const selected = interaction.options.getChannel('channel')
    const chosen = selected
        ? channelChoice(selected)
        : await channelWhereTyped(interaction)
    if (!chosen) return { reply: 'Pick a text channel.' }
    if (isThread(chosen.type)) {
        return { reply: 'Pick a text channel, not a thread.' }
    }
    if (chosen.type !== ChannelType.GuildText) {
        return { reply: 'Pick a text channel.' }
    }
    return { id: chosen.id }
}

function channelChoice(channel: {
    id: string
    type: ChannelType
}): ChannelChoice {
    return { id: channel.id, type: channel.type }
}

// BaseInteraction.channel is only the channel cache, which stays empty with intents: [].
async function channelWhereTyped(
    interaction: CommandInteraction
): Promise<ChannelChoice | null> {
    if (interaction.channel) return channelChoice(interaction.channel)
    if (!interaction.channelId) return null

    const fetched = await interaction.client.channels.fetch(
        interaction.channelId
    )
    if (!fetched) return null
    return channelChoice(fetched)
}

function isThread(type: ChannelType): boolean {
    return (
        type === ChannelType.PublicThread ||
        type === ChannelType.PrivateThread ||
        type === ChannelType.AnnouncementThread
    )
}
