import type { Interaction } from 'discord.js'
import { Client, Collection, Events } from 'discord.js'

import { tryCatch } from '@nxt/utils'

import { commands } from '~/commands'
import type { ExtendedClient } from '~/lib/types'

import { env } from '~/env'

const client = new Client({
    intents: [],
}) as ExtendedClient

client.commands = new Collection()
client.once(Events.ClientReady, (c) => {
    for (const command of Object.values(commands)) {
        client.commands.set(command.data.name, command)
    }

    console.log(`Logged in as ${c.user?.tag}!`)
    console.log(`Loaded ${client.commands.size} commands.`)
})

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return

    const command = client.commands.get(interaction.commandName)
    if (!command) {
        console.log('No command found for ', interaction.commandName)
        return
    }

    const { error } = await tryCatch(command.execute(interaction))
    if (error) {
        console.error('Error executing command', error)
        const errorMessage = {
            content: `An error occurred while executing the command: ${error.message}`,
            ephemeral: true,
        }

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage)
        } else {
            await interaction.reply(errorMessage)
        }
    }
})

client.login(env.DISCORD_TOKEN)
