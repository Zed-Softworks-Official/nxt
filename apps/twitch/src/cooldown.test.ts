import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    seedTwitchCommunity,
    twitchBot,
} from './test/chatHarness'

const COOLDOWN_MS = 15_000

async function botWithClock() {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state: 'open',
    })
    const clock = { now: 1_000_000 }
    const bot = twitchBot(backend, { now: () => clock.now })
    return { ...bot, clock }
}

test.each([
    'pos',
    'view',
])('!nxt %s is ignored when the same chatter repeats it within the cooldown', async (command) => {
    const { handle, sent, clock } = await botWithClock()

    await handle(chatMessage(`!nxt ${command}`))
    clock.now += COOLDOWN_MS - 1
    await handle(chatMessage(`!nxt ${command}`))

    expect(sent).toHaveLength(1)
})

test.each([
    'pos',
    'view',
])('!nxt %s answers again once the cooldown has passed', async (command) => {
    const { handle, sent, clock } = await botWithClock()

    await handle(chatMessage(`!nxt ${command}`))
    clock.now += COOLDOWN_MS
    await handle(chatMessage(`!nxt ${command}`))

    expect(sent).toHaveLength(2)
})

test("one chatter's cooldown does not hold back another chatter", async () => {
    const { handle, sent } = await botWithClock()

    await handle(chatMessage('!nxt pos'))
    await handle(
        chatMessage('!nxt pos', {
            chatterId: 'user-2',
            chatterLogin: 'bob',
            chatterName: 'Bob',
        })
    )

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada You are not waiting in the queue.',
        '@Bob You are not waiting in the queue.',
    ])
})

test('pos and view have separate cooldowns', async () => {
    const { handle, sent } = await botWithClock()

    await handle(chatMessage('!nxt pos'))
    await handle(chatMessage('!nxt view'))

    expect(sent).toHaveLength(2)
})

test('join and leave are not cooled down', async () => {
    const { handle, sent } = await botWithClock()

    await handle(chatMessage('!nxt join'))
    await handle(chatMessage('!nxt leave'))
    await handle(chatMessage('!nxt join'))

    expect(sent.map((entry) => entry.text)).toEqual([
        '@Ada You joined the queue as q-1.',
        '@Ada You left the queue.',
        '@Ada You joined the queue as q-2.',
    ])
})
