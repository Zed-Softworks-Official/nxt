import type {
    Client,
    Collection,
    CommandInteraction,
    SlashCommandBuilder,
} from 'discord.js'

export interface Command {
    data: SlashCommandBuilder
    execute: (interaction: CommandInteraction) => Promise<void>
}

export interface ExtendedClient extends Client {
    commands: Collection<string, Command>
}
