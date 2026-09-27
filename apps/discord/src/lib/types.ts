import type {
    Client,
    Collection,
    CommandInteraction,
    SlashCommandBuilder,
} from 'discord.js'

import type { QueueConvex } from '~/lib/convex'

export interface Command {
    data: SlashCommandBuilder
    execute: (
        interaction: CommandInteraction,
        client?: QueueConvex
    ) => Promise<void>
}

export interface ExtendedClient extends Client {
    commands: Collection<string, Command>
}
