import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

// The Twitch network calls Twitch linking needs, behind one injectable client
// so tests never touch the network. Production uses `httpTwitchClient`; tests
// install a fake with `setTwitchClient`.

/** The broadcaster's OAuth grant from the authorization-code flow. */
export type TwitchGrant = {
    accessToken: string
    refreshToken: string
    scopes: string[]
    /** Epoch ms at which the access token expires. */
    expiresAt: number
}

/** The Twitch user a grant belongs to. */
export type TwitchUser = {
    id: string
    login: string
    displayName: string
}

export interface TwitchClient {
    /** Exchange an authorization code for the user's grant. */
    exchangeCode(code: string): Promise<TwitchGrant>
    /** The user who owns `accessToken`. */
    getUser(accessToken: string): Promise<TwitchUser>
    /**
     * Create the `channel.chat.message` EventSub subscription for a
     * broadcaster's chat, read as the Nxt bot account. Returns its ID.
     */
    subscribeToChat(broadcasterId: string): Promise<string>
    /** Delete an EventSub subscription. A missing one counts as deleted. */
    deleteSubscription(subscriptionId: string): Promise<void>
}

let override: TwitchClient | null = null

/** The client Twitch linking uses. */
export function twitchClient(): TwitchClient {
    return override ?? httpTwitchClient
}

/** Replace the Twitch client (tests). Pass `null` to restore the real one. */
export function setTwitchClient(client: TwitchClient | null) {
    override = client
}

// Read lazily so deployments and tests that never link Twitch need no
// Twitch configuration.
function twitchEnv() {
    return createEnv({
        server: {
            TWITCH_CLIENT_ID: z.string(),
            TWITCH_CLIENT_SECRET: z.string(),
            // Must match the redirect URI the dashboard sends to Twitch: this
            // deployment's `/twitch` HTTP route.
            TWITCH_REDIRECT_URI: z.string().url(),
            TWITCH_BOT_USER_ID: z.string(),
            TWITCH_EVENTSUB_HOSTNAME: z.string(),
            TWITCH_EVENTSUB_SECRET: z.string().min(10).max(100),
        },
        isServer: true,
        runtimeEnv: process.env,
        emptyStringAsUndefined: true,
    })
}

const ID_URL = 'https://id.twitch.tv/oauth2'
const HELIX_URL = 'https://api.twitch.tv/helix'

async function expectOk(response: Response, what: string) {
    if (response.ok) return
    const body = await response.text()
    throw new Error(`Twitch ${what} failed (${response.status}): ${body}`)
}

let appToken: { token: string; expiresAt: number } | null = null

async function appAccessToken(): Promise<string> {
    if (appToken && appToken.expiresAt > Date.now() + 60_000) {
        return appToken.token
    }
    const env = twitchEnv()
    const response = await fetch(`${ID_URL}/token`, {
        method: 'POST',
        body: new URLSearchParams({
            client_id: env.TWITCH_CLIENT_ID,
            client_secret: env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials',
        }),
    })
    await expectOk(response, 'app token')
    const body = (await response.json()) as {
        access_token: string
        expires_in: number
    }
    appToken = {
        token: body.access_token,
        expiresAt: Date.now() + body.expires_in * 1000,
    }
    return appToken.token
}

async function helix(path: string, init: RequestInit, token: string) {
    const env = twitchEnv()
    return await fetch(`${HELIX_URL}${path}`, {
        ...init,
        headers: {
            ...init.headers,
            Authorization: `Bearer ${token}`,
            'Client-Id': env.TWITCH_CLIENT_ID,
        },
    })
}

type Subscription = {
    id: string
    type: string
    condition: { broadcaster_user_id?: string; user_id?: string }
}

export const httpTwitchClient: TwitchClient = {
    async exchangeCode(code) {
        const env = twitchEnv()
        const response = await fetch(`${ID_URL}/token`, {
            method: 'POST',
            body: new URLSearchParams({
                client_id: env.TWITCH_CLIENT_ID,
                client_secret: env.TWITCH_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: env.TWITCH_REDIRECT_URI,
            }),
        })
        await expectOk(response, 'code exchange')
        const body = (await response.json()) as {
            access_token: string
            refresh_token: string
            expires_in: number
            scope?: string[]
        }
        return {
            accessToken: body.access_token,
            refreshToken: body.refresh_token,
            scopes: body.scope ?? [],
            expiresAt: Date.now() + body.expires_in * 1000,
        }
    },

    async getUser(accessToken) {
        const response = await helix('/users', {}, accessToken)
        await expectOk(response, 'get user')
        const body = (await response.json()) as {
            data: { id: string; login: string; display_name: string }[]
        }
        const user = body.data[0]
        if (!user) throw new Error('Twitch returned no user for the token')
        return {
            id: user.id,
            login: user.login,
            displayName: user.display_name,
        }
    },

    async subscribeToChat(broadcasterId) {
        const env = twitchEnv()
        const token = await appAccessToken()
        // The callback and secret match what the Twurple listener in
        // apps/twitch builds, so it adopts this subscription as its own.
        const subscriptionKey = `channel.chat.message.${broadcasterId}.${env.TWITCH_BOT_USER_ID}`
        const response = await helix(
            '/eventsub/subscriptions',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'channel.chat.message',
                    version: '1',
                    condition: {
                        broadcaster_user_id: broadcasterId,
                        user_id: env.TWITCH_BOT_USER_ID,
                    },
                    transport: {
                        method: 'webhook',
                        callback: `https://${env.TWITCH_EVENTSUB_HOSTNAME}/event/${subscriptionKey}`,
                        secret: env.TWITCH_EVENTSUB_SECRET,
                    },
                }),
            },
            token
        )
        // 409: the subscription already exists (for example, the adapter
        // created it). Adopt the existing one.
        if (response.status === 409) {
            const existing = await findChatSubscription(
                broadcasterId,
                env.TWITCH_BOT_USER_ID,
                token
            )
            if (existing) return existing.id
        }
        await expectOk(response, 'create EventSub subscription')
        const body = (await response.json()) as { data: Subscription[] }
        const created = body.data[0]
        if (!created) throw new Error('Twitch returned no subscription')
        return created.id
    },

    async deleteSubscription(subscriptionId) {
        const token = await appAccessToken()
        const response = await helix(
            `/eventsub/subscriptions?${new URLSearchParams({ id: subscriptionId })}`,
            { method: 'DELETE' },
            token
        )
        if (response.status === 404) return
        await expectOk(response, 'delete EventSub subscription')
    },
}

async function findChatSubscription(
    broadcasterId: string,
    botUserId: string,
    token: string
): Promise<Subscription | null> {
    let cursor: string | undefined
    do {
        const params = new URLSearchParams({ type: 'channel.chat.message' })
        if (cursor) params.set('after', cursor)
        const response = await helix(
            `/eventsub/subscriptions?${params}`,
            {},
            token
        )
        await expectOk(response, 'list EventSub subscriptions')
        const body = (await response.json()) as {
            data: Subscription[]
            pagination?: { cursor?: string }
        }
        const match = body.data.find(
            (sub) =>
                sub.condition.broadcaster_user_id === broadcasterId &&
                sub.condition.user_id === botUserId
        )
        if (match) return match
        cursor = body.pagination?.cursor
    } while (cursor)
    return null
}
