import { expect, test } from 'vitest'
import {
    BOT_USER_ID,
    chatMessage,
    createTestBackend,
    readQueue,
    seedTwitchCommunity,
    twitchBot,
} from './test/chatHarness'

async function openChannel() {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    return backend
}

test('messages that do not start with a command are ignored', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('hello chat'))
    await handle(chatMessage('joinq'))
    await handle(chatMessage('please !joinq'))
    await handle(chatMessage('! joinq'))

    expect(sent).toEqual([])
    expect((await readQueue(backend, 'owner-1'))?.participants).toEqual([])
})

test('commands are case-insensitive', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('  !JoinQ  '))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada You joined the queue as q-1.',
    ])
})

test("the Nxt bot account's own messages are ignored", async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(
        chatMessage('!joinq', {
            chatterId: BOT_USER_ID,
            chatterLogin: 'nxtbot',
            chatterName: 'NxtBot',
        })
    )

    expect(sent).toEqual([])
    expect((await readQueue(backend, 'owner-1'))?.participants).toEqual([])
})

test('unknown commands are left to other bots and get no reply', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!dance'))
    await handle(chatMessage('!join'))
    await handle(chatMessage('!nxtjoin'))

    expect(sent).toEqual([])
})

test('!nxt gets a usage reply', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)
    const message = chatMessage('!nxt')

    await handle(message)

    expect(sent).toEqual([
        {
            kind: 'reply',
            channelId: 'broadcaster-1',
            parentMessageId: message.messageId,
            text: '@ada Usage: !joinq | !leaveq | !pos | !viewq',
        },
    ])
})

test('a channel with no enabled Platform Link gets no reply', async () => {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
        enabled: false,
    })
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!joinq'))
    await handle(chatMessage('!joinq', { broadcasterId: 'elsewhere' }))

    expect(sent).toEqual([])
    expect((await readQueue(backend, 'owner-1'))?.participants).toEqual([])
})

test('!nxt from a Twitch Admin lists the Admin commands too', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt', { badges: { moderator: '1' } }))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@ada Usage: !joinq | !leaveq | !pos | !viewq. Admins: !startq | !endq | !clearq | !pingq [count] | !playq <ref> | !returnq <ref> | !doneq <ref>',
    ])
})

test('replies @mention the chatter by login, not their localised display name', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(
        chatMessage('!joinq', {
            chatterLogin: 'kurisu',
            chatterName: '牧瀬紅莉栖',
        })
    )

    expect(sent.map((entry) => entry.text)).toEqual([
        '@kurisu You joined the queue as q-1.',
    ])
})

test.each([
    'constructor',
    'toString',
    '__proto__',
    'hasOwnProperty',
])('!%s is not a command and gets no reply', async (name) => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage(`!${name}`))

    expect(sent).toEqual([])
})
