import {
    createTestBackend,
    readActivityLog,
    readQueue,
    type SeedParticipant,
    seedCommunity,
    seedTwitchCommunity,
    type TestBackend,
} from '@nxt/backend/testing'
import { createChatHandler } from '~/handler'
import type { ChatMessage, ChatSender } from '~/lib/chat'
import type { QueueConvex } from '~/lib/convex'

// The backend harness is shared with every platform adapter; this file adds
// only the Twitch-specific fakes. No Twurple types appear here.
export {
    createTestBackend,
    readActivityLog,
    readQueue,
    seedCommunity,
    seedTwitchCommunity,
}
export type { SeedParticipant }

export const BOT_USER_ID = 'bot-1'

export function asQueueConvex(backend: TestBackend): QueueConvex {
    return backend as unknown as QueueConvex
}

let messageCount = 0

// A chat message from `ada` (user-1) in broadcaster-1's channel.
export function chatMessage(
    text: string,
    overrides: Partial<Omit<ChatMessage, 'text'>> = {}
): ChatMessage {
    messageCount += 1
    return {
        broadcasterId: 'broadcaster-1',
        chatterId: 'user-1',
        chatterLogin: 'ada',
        chatterName: 'Ada',
        badges: {},
        messageId: `message-${messageCount}`,
        ...overrides,
        text,
    }
}

export type SentChat =
    | {
          kind: 'reply'
          channelId: string
          parentMessageId: string
          text: string
      }
    | { kind: 'say'; channelId: string; text: string }

// A ChatSender that records what would have been posted.
export function fakeSender() {
    const sent: SentChat[] = []
    const sender: ChatSender = {
        reply: async (channelId, parentMessageId, text) => {
            sent.push({ kind: 'reply', channelId, parentMessageId, text })
        },
        say: async (channelId, text) => {
            sent.push({ kind: 'say', channelId, text })
        },
    }
    return { sender, sent }
}

// The chat handler wired to an in-memory backend and a recording sender.
export function twitchBot(
    backend: TestBackend,
    options: { now?: () => number } = {}
) {
    const { sender, sent } = fakeSender()
    const handle = createChatHandler({
        convex: asQueueConvex(backend),
        sender,
        botUserId: BOT_USER_ID,
        ...options,
    })
    return { handle, sent }
}
