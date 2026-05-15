import type { CommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

export const joinQ = {
    data: new SlashCommandBuilder()
        .setName('joinq')
        .setDescription('Join the queue'),
    async execute(interaction: CommandInteraction) {
        interaction.reply('Joined the queue')
    },
}
