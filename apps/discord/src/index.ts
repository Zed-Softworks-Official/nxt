import { Client, Collection, Events } from 'discord.js'

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

client.login(env.DISCORD_TOKEN)
