import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

import { api } from '@nxt/backend/api'
import { tryCatch } from '@nxt/utils'

import { convex } from '~/lib/convex'
import type { Command } from '~/lib/types'

export const leaveQ: Command = {
    data: new SlashCommandBuilder()
        .setName('leaveq')
        .setDescription('Leave the queue'),
    async execute(interaction: CommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply('This command can only be used in a server')
            return
        }

        const { error } = await tryCatch(
            convex.mutation(api.discord.leaveQ, {
                platformUserId: interaction.user.id,
                platformId: interaction.guildId,
            })
        )

        if (error) {
            await interaction.reply('Error leaving the queue')
            return
        }

        await interaction.reply('Left the queue')
    },
}
