import { tryCatch } from '@nxt/utils'
import { REST, Routes } from 'discord.js'

import { commands } from '~/commands'
import { env } from '~/env'

async function deployCommands() {
    const commandsData = Object.values(commands).map((command) =>
        command.data.toJSON()
    )

    if (commandsData.length === 0) {
        console.log('No commands to deploy.')
        return
    }

    const rest = new REST().setToken(env.DISCORD_TOKEN)

    const { error } = await tryCatch(
        (async () => {
            if (env.GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(
                        env.DISCORD_CLIENT_ID,
                        env.GUILD_ID
                    ),
                    {
                        body: commandsData,
                    }
                )

                console.log(`Deployed Commands to Guild ${env.GUILD_ID}`)
            } else {
                await rest.put(
                    Routes.applicationCommands(env.DISCORD_CLIENT_ID),
                    {
                        body: commandsData,
                    }
                )

                console.log('Deployed Commands to Global')
            }
        })()
    )

    console.log(`Body sent to Discord: ${JSON.stringify(commandsData)}`)

    if (error) {
        console.error(`Error Deploying Commands: ${error}`)
        throw error
    }

    return
}

deployCommands()
    .then(() => {
        console.log('Successfully Deployed Commands')
        process.exit(0)
    })
    .catch((error) => {
        console.error('Error Deploying Commands', error)
        process.exit(1)
    })
