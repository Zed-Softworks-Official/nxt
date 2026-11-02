import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

// The Discord network call Discord linking needs, behind one injectable
// client so tests never touch the network. Production uses
// `httpDiscordClient`; tests install a fake with `setDiscordClient`.

export interface DiscordClient {
    /**
     * Exchange the authorization code from a bot-install redirect. Returns
     * the ID of the guild the bot was installed in, which Discord reports in
     * the token response.
     */
    exchangeBotInstallCode(code: string): Promise<{ guildId: string }>
}

let override: DiscordClient | null = null

/** The client Discord linking uses. */
export function discordClient(): DiscordClient {
    return override ?? httpDiscordClient
}

/** Replace the Discord client (tests). Pass `null` to restore the real one. */
export function setDiscordClient(client: DiscordClient | null) {
    override = client
}

// Read lazily so deployments and tests that never link Discord need no
// Discord configuration.
function discordEnv() {
    return createEnv({
        server: {
            DISCORD_CLIENT_ID: z.string(),
            DISCORD_CLIENT_SECRET: z.string(),
            // Must match the redirect URI the dashboard sends to Discord:
            // this deployment's `/discord` HTTP route.
            DISCORD_REDIRECT_URI: z.string().url(),
        },
        isServer: true,
        runtimeEnv: process.env,
        emptyStringAsUndefined: true,
    })
}

export const httpDiscordClient: DiscordClient = {
    async exchangeBotInstallCode(code) {
        const env = discordEnv()
        const response = await fetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: env.DISCORD_CLIENT_ID,
                client_secret: env.DISCORD_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: env.DISCORD_REDIRECT_URI,
            }),
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(
                `Discord code exchange failed (${response.status}): ${body}`
            )
        }
        const body = (await response.json()) as { guild?: { id?: string } }
        const guildId = body.guild?.id
        if (!guildId) throw new Error('Discord returned no guild for the code')
        return { guildId }
    },
}
