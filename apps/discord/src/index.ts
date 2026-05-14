import { Client, Events, GatewayIntentBits } from 'discord.js'

import { env } from '~/env'

const client = new Client({
    intents: [GatewayIntentBits.GuildMembers, GatewayIntentBits.Guilds],
})

client.on(Events.ClientReady, (c) => {
    console.log(`Ready as ${c.user.tag}`)
})

client.login(env.DISCORD_TOKEN)
