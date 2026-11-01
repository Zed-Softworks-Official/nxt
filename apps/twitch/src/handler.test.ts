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

test('messages that do not start with !nxt are ignored', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('hello chat'))
    await handle(chatMessage('!nxtjoin'))
    await handle(chatMessage('please !nxt join'))

    expect(sent).toEqual([])
    expect((await readQueue(backend, 'owner-1'))?.participants).toEqual([])
})

test('the prefix and subcommand are case-insensitive', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('  !NXT Join  '))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada You joined the queue as q-1.',
    ])
})

test("the Nxt bot account's own messages are ignored", async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(
        chatMessage('!nxt join', {
            chatterId: BOT_USER_ID,
            chatterLogin: 'nxtbot',
            chatterName: 'NxtBot',
        })
    )

    expect(sent).toEqual([])
    expect((await readQueue(backend, 'owner-1'))?.participants).toEqual([])
})

test('an unknown subcommand gets a usage reply', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)
    const message = chatMessage('!nxt dance')

    await handle(message)

    expect(sent).toEqual([
        {
            kind: 'reply',
            channelId: 'broadcaster-1',
            parentMessageId: message.messageId,
            text: '@Ada Usage: !nxt join | leave | pos | view',
        },
    ])
})

test('a bare !nxt gets a usage reply', async () => {
    const backend = await openChannel()
    const { handle, sent } = twitchBot(backend)

    await handle(chatMessage('!nxt'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada Usage: !nxt join | leave | pos | view',
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

    await handle(chatMessage('!nxt join'))
    await handle(chatMessage('!nxt join', { broadcasterId: 'elsewhere' }))

    expect(sent).toEqual([])
    expect((await readQueue(backend, 'owner-1'))?.participants).toEqual([])
})
