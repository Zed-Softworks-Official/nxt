import { expect, test } from 'vitest'
import {
    chatMessage,
    createTestBackend,
    type SeedParticipant,
    seedTwitchCommunity,
    twitchBot,
} from '../test/chatHarness'

async function viewWith(
    state: 'open' | 'paused',
    participants: SeedParticipant[]
) {
    const backend = createTestBackend()
    await seedTwitchCommunity(backend, {
        ownerId: 'owner-1',
        broadcasterId: 'broadcaster-1',
        state,
        participants,
    })
    const { handle, sent } = twitchBot(backend)
    await handle(chatMessage('!nxt view'))
    return sent.map((entry) => entry.text)
}

test('!nxt view lists the front of the queue with references and platforms', async () => {
    expect(
        await viewWith('open', [
            { platformUserId: 'user-2', username: 'Bob', status: 'notified' },
            { platformUserId: 'user-1', username: 'Ada', status: 'waiting' },
            {
                platformUserId: 'user-3',
                username: 'cy',
                status: 'waiting',
                platform: 'discord',
            },
        ])
    ).toEqual([
        '@Ada The queue is open. Next: 1. q-2 Ada (Twitch), 2. q-3 cy (Discord)',
    ])
})

test('!nxt view on an empty paused queue says nobody is waiting', async () => {
    expect(await viewWith('paused', [])).toEqual([
        '@Ada The queue is paused. Nobody is waiting.',
    ])
})

test('!nxt view shows the first five and counts the rest', async () => {
    const participants = Array.from({ length: 7 }, (_, index) => ({
        platformUserId: `user-${index + 1}`,
        username: `p${index + 1}`,
        status: 'waiting' as const,
    }))

    expect(await viewWith('open', participants)).toEqual([
        '@Ada The queue is open. Next: 1. q-1 p1 (Twitch), 2. q-2 p2 (Twitch), 3. q-3 p3 (Twitch), 4. q-4 p4 (Twitch), 5. q-5 p5 (Twitch) …and 2 more.',
    ])
})
