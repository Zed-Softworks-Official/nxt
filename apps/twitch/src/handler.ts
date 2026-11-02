import { commands } from '~/commands'
import type { ChatMessage, ChatSender } from '~/lib/chat'
import type { QueueConvex } from '~/lib/convex'
import { createCooldown } from '~/lib/cooldown'

const PREFIX = '!nxt'
const USAGE = 'Usage: !nxt join | leave | pos | view'
const ADMIN_USAGE = `${USAGE}. Admins: open | pause | clear | ping [count] | play <ref> | return <ref> | done <ref>`
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
                `@${message.chatterLogin} ${text}`
            )

        const commandName = name.toLowerCase()
        const command = commands.get(commandName)
        if (!command) {
            await reply(isTwitchAdmin(message) ? ADMIN_USAGE : USAGE)
            return
        }

        if (command.admin && !isTwitchAdmin(message)) {
            await reply(
                `Only the broadcaster and moderators can run !nxt ${commandName}.`
            )
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

// A Twitch Admin is the broadcaster, or anyone wearing a moderator or
// broadcaster badge on this message (CONTEXT.md, Admin).
function isTwitchAdmin(message: ChatMessage): boolean {
    return (
        message.chatterId === message.broadcasterId ||
        'moderator' in message.badges ||
        'broadcaster' in message.badges
    )
}
