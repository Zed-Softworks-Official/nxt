import { commands } from '~/commands'
import type { ChatMessage, ChatSender } from '~/lib/chat'
import type { QueueConvex } from '~/lib/convex'
import { createCooldown } from '~/lib/cooldown'

const PREFIX = '!nxt'
const USAGE = 'Usage: !nxt join | leave | pos | view'
const COOLDOWN_MS = 15_000

// Builds the one handler every `channel.chat.message` event goes through. It
// parses `!nxt <command> [arg]`, runs the command against the Queue module and
// replies `@user …` in the channel. The cooldown state lives in the closure.
export function createChatHandler(deps: {
    convex: QueueConvex
    sender: ChatSender
    // The Nxt bot account's user ID; its own messages are ignored.
    botUserId: string
    now?: () => number
}) {
    const cooldown = createCooldown(COOLDOWN_MS, deps.now ?? Date.now)

    return async function handleChatMessage(message: ChatMessage) {
        if (message.chatterId === deps.botUserId) return

        const [prefix, name = '', ...rest] = message.text.trim().split(/\s+/)
        if (prefix?.toLowerCase() !== PREFIX) return

        const reply = (text: string) =>
            deps.sender.reply(
                message.broadcasterId,
                message.messageId,
                `@${message.chatterName} ${text}`
            )

        const commandName = name.toLowerCase()
        const command = commands[commandName]
        if (!command) {
            await reply(USAGE)
            return
        }

        if (command.cooldown) {
            const key = `${message.broadcasterId}:${message.chatterId}:${commandName}`
            if (!cooldown.tryUse(key)) return
        }

        const result = await command.run({
            convex: deps.convex,
            message,
            link: { platform: 'twitch', platformId: message.broadcasterId },
            arg: rest.join(' '),
        })
        if (result === null) return
        await reply(result)
    }
}
