import type { ChatMessage } from '~/lib/chat'
import type { QueueConvex } from '~/lib/convex'

export type PlatformLink = { platform: 'twitch'; platformId: string }

export type CommandContext = {
    convex: QueueConvex
    message: ChatMessage
    link: PlatformLink
    // The text after `!<command>`, trimmed. Empty when absent.
    arg: string
    // The chatter is a Twitch Admin (the broadcaster or a moderator).
    isAdmin: boolean
    // Stops this chatter's runs of this command for the cooldown, after a
    // refusal. They get no reply until it ends.
    startCooldown(): void
}

export interface TwitchCommand {
    // Only a Twitch Admin (the broadcaster or a moderator) may run it.
    admin?: boolean
    // Subject to the per-user cooldown (for read-only commands that could
    // flood chat).
    cooldown?: boolean | ((arg: string) => boolean)
    // Runs the command and returns the reply text (without the `@user`
    // prefix), or null to stay silent, e.g. when the channel has no enabled
    // Platform Link.
    run(context: CommandContext): Promise<string | null>
}
