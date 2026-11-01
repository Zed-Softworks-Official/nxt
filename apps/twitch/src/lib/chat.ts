// The trimmed-down chat message the handler works with. The Twurple wiring in
// `index.ts` maps EventSub's `channel.chat.message` event onto this shape.
export type ChatMessage = {
    broadcasterId: string
    chatterId: string
    chatterLogin: string
    chatterName: string
    // Badge set ID → version, e.g. { moderator: '1' }.
    badges: Record<string, string>
    text: string
    messageId: string
}

// Posts chat as the Nxt bot account. `channelId` is the broadcaster's user ID.
export interface ChatSender {
    reply(
        channelId: string,
        parentMessageId: string,
        text: string
    ): Promise<void>
    say(channelId: string, text: string): Promise<void>
}
