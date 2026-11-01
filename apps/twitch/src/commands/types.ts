import type { ChatMessage } from '~/lib/chat'
import type { QueueConvex } from '~/lib/convex'

export type PlatformLink = { platform: 'twitch'; platformId: string }

export type CommandContext = {
    convex: QueueConvex
    message: ChatMessage
    link: PlatformLink
    // The text after `!nxt <command>`, trimmed. Empty when absent.
    arg: string
}

export interface TwitchCommand {
    // Subject to the per-user cooldown (for read-only commands that could
    // flood chat).
    cooldown?: boolean
    // Runs the command and returns the reply text (without the `@user`
    // prefix), or null to stay silent, e.g. when the channel has no enabled
    // Platform Link.
    run(context: CommandContext): Promise<string | null>
}
