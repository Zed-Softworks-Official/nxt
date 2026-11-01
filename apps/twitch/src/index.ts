import { internal } from '@nxt/backend/api'
import { tryCatch } from '@nxt/utils'
import type { EventSubSubscription } from '@twurple/eventsub-base'

import { env } from '~/env'
import { createChatHandler } from '~/handler'
import { getConvex } from '~/lib/convex'
import {
    createChatSender,
    createEventSubListener,
    createTwitchApi,
    toChatMessage,
} from '~/lib/twitch'

// How often to pick up channels linked or unlinked from the dashboard.
const SYNC_INTERVAL_MS = 60_000

const convex = getConvex()
const api = createTwitchApi({
    clientId: env.TWITCH_CLIENT_ID,
    clientSecret: env.TWITCH_CLIENT_SECRET,
})
const handle = createChatHandler({
    convex,
    sender: createChatSender(api, env.TWITCH_BOT_USER_ID),
    botUserId: env.TWITCH_BOT_USER_ID,
})
const listener = createEventSubListener(api, {
    hostName: env.TWITCH_EVENTSUB_HOSTNAME,
    port: env.TWITCH_EVENTSUB_PORT,
    secret: env.TWITCH_EVENTSUB_SECRET,
})

// One `channel.chat.message` subscription per linked channel, read as the Nxt
// bot account. Twurple reuses a subscription that already exists for the same
// callback URL, so one created at link time is picked up rather than doubled.
const subscriptions = new Map<string, EventSubSubscription>()

async function syncChannels() {
    const linked = new Set(
        await convex.query(internal.twitchChannels.linked, {})
    )
    for (const broadcasterId of linked) {
        if (subscriptions.has(broadcasterId)) continue
        subscriptions.set(
            broadcasterId,
            listener.onChannelChatMessage(
                broadcasterId,
                env.TWITCH_BOT_USER_ID,
                async (event) => {
                    const { error } = await tryCatch(
                        handle(toChatMessage(event))
                    )
                    if (error)
                        console.error('Error handling chat message', error)
                }
            )
        )
    }
    for (const [broadcasterId, subscription] of subscriptions) {
        if (linked.has(broadcasterId)) continue
        subscription.stop()
        subscriptions.delete(broadcasterId)
    }
}

async function sync() {
    const { error } = await tryCatch(syncChannels())
    if (error) console.error('Error syncing Twitch channels', error)
}

listener.start()
void sync().then(() => {
    console.log(`Listening for Twitch chat in ${subscriptions.size} channels.`)
    setInterval(sync, SYNC_INTERVAL_MS)
})
