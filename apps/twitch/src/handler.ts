import { commands } from '~/commands'
import type { ChatMessage, ChatSender } from '~/lib/chat'
import type { QueueConvex } from '~/lib/convex'
import { createCooldown } from '~/lib/cooldown'

const PREFIX = '!'
// `!nxt` is the help command: it lists the commands instead of running one.
const HELP = 'nxt'
const USAGE = 'Usage: !joinq | !leaveq | !pos | !viewq'
const ADMIN_USAGE = `${USAGE}. Admins: !startq | !endq | !clearq | !pingq [count] | !playq <ref> | !returnq <ref> | !doneq <ref>`
const COOLDOWN_MS = 15_000

// Builds the one handler every `channel.chat.message` event goes through. It
// parses `!<command> [arg]`, runs the command against the Queue module and
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

        const [first = '', ...rest] = message.text.trim().split(/\s+/)
        if (!first.startsWith(PREFIX)) return
        const commandName = first.slice(PREFIX.length).toLowerCase()

        const reply = (text: string) =>
            deps.sender.reply(
                message.broadcasterId,
                message.messageId,
                `@${message.chatterLogin} ${text}`
            )

        if (commandName === HELP) {
            await reply(isTwitchAdmin(message) ? ADMIN_USAGE : USAGE)
            return
        }

        // Other bots share the channel, so unknown `!` commands are not ours
        // and get no reply.
        const command = commands.get(commandName)
        if (!command) return

        if (command.admin && !isTwitchAdmin(message)) {
            await reply(
                `Only the broadcaster and moderators can run !${commandName}.`
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
