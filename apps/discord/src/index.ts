import { internal } from '@nxt/backend/api'
import { tryCatch } from '@nxt/utils'
import type { Interaction } from 'discord.js'
import { Client, Collection, Events } from 'discord.js'

import {
    type AnnouncementSender,
    deliverPending,
    serialDeliverer,
} from '~/announcements/deliver'
import { commands } from '~/commands'
import { env } from '~/env'
import { getConvex, getConvexSubscriber } from '~/lib/convex'
import { editDeferred } from '~/lib/queueGate'
import type { ExtendedClient } from '~/lib/types'

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

    startAnnouncements()
})

const discordSender: AnnouncementSender = {
    async send(channelId, content) {
        const channel = await client.channels.fetch(channelId)
        if (!channel?.isSendable()) {
            throw new Error(`Cannot post in channel ${channelId}`)
        }
        await channel.send(content)
    },
}

// Post pending Announcements now and whenever the set of pending ones changes.
function startAnnouncements() {
    const deliver = serialDeliverer(() =>
        deliverPending(getConvex(), discordSender)
    )
    getConvexSubscriber().onUpdate(
        internal.announcements.pending,
        { platform: 'discord' },
        () => deliver(),
        (error) => console.error('Announcement subscription failed', error)
    )
}

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

        if (interaction.deferred && !interaction.replied) {
            await editDeferred(interaction, errorMessage)
        } else if (interaction.replied) {
            await interaction.followUp(errorMessage)
        } else {
            await interaction.reply(errorMessage)
        }
    }
})

client.login(env.DISCORD_TOKEN)
