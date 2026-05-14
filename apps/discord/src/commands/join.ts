import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

export const joinQCommand = {
    data: new SlashCommandBuilder()
        .setName('joinq')
        .setDescription('Join the queue'),
    async execute(interaction: CommandInteraction) {
        await interaction.reply('Joined')
    },
}
