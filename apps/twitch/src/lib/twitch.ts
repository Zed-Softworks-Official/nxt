import { ApiClient } from '@twurple/api'
import { RefreshingAuthProvider } from '@twurple/auth'
import type { EventSubChannelChatMessageEvent } from '@twurple/eventsub-base'
import {
    EventSubHttpListener,
    ReverseProxyAdapter,
} from '@twurple/eventsub-http'

import type { ChatMessage, ChatSender } from '~/lib/chat'

// The only file that touches Twurple. Untested by design: signature checks,
// token refresh and listener wiring are Twurple's job.

export function createTwitchApi(config: {
    clientId: string
    clientSecret: string
}) {
    // With a client secret, the provider fetches and refreshes the app access
    // token that EventSub webhooks and app-token chat messages use.
    const authProvider = new RefreshingAuthProvider(config)
    return new ApiClient({ authProvider })
}

// Sends chat as the Nxt bot account, using the app access token so replies
// carry the Chat Bot badge. Twitch silently drops some messages (e.g. AutoMod);
// those are logged, not retried.
export function createChatSender(
    api: ApiClient,
    botUserId: string
): ChatSender {
    const send = async (channelId: string, text: string, parentId?: string) => {
        const sent = await api.chat.sendChatMessageAsApp(
            botUserId,
            channelId,
            text,
            parentId ? { replyParentMessageId: parentId } : undefined
        )
        if (!sent.isSent) {
            console.warn(
                `Twitch dropped a message in ${channelId}: ${sent.dropReasonMessage}`
            )
        }
    }
    return {
        reply: (channelId, parentMessageId, text) =>
            send(channelId, text, parentMessageId),
        say: (channelId, text) => send(channelId, text),
    }
}

export function createEventSubListener(
    api: ApiClient,
    config: { hostName: string; port: number; secret: string }
) {
    return new EventSubHttpListener({
        apiClient: api,
        adapter: new ReverseProxyAdapter({
            hostName: config.hostName,
            port: config.port,
        }),
        secret: config.secret,
    })
}

export function toChatMessage(
    event: EventSubChannelChatMessageEvent
): ChatMessage {
    return {
        broadcasterId: event.broadcasterId,
        chatterId: event.chatterId,
        chatterLogin: event.chatterName,
        chatterName: event.chatterDisplayName,
        badges: event.badges,
        text: event.messageText,
        messageId: event.messageId,
    }
}
