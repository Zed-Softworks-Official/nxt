import { api } from '@nxt/backend/api'
import { tryCatch } from '@nxt/utils'
import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

import { convex } from '~/lib/convex'
import type { Command } from '~/lib/types'

export const joinQ: Command = {
    data: new SlashCommandBuilder()
        .setName('joinq')
        .setDescription('Join the queue'),
    async execute(interaction: CommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply('This command can only be used in a server')
            return
        }

        const { error } = await tryCatch(
            convex.mutation(api.discord.joinQ, {
                username: interaction.user.username,
                platformUserId: interaction.user.id,
                platformId: interaction.guildId,
            })
        )

        if (error) {
            await interaction.reply('Error joining the queue')
            return
        }

        await interaction.reply('Joined the queue')
    },
}
