import { api } from '@nxt/backend/api'
import {
    createTestBackend,
    readActivityLog,
    readQueue,
    type SeedParticipant,
    seedCommunity,
    type TestBackend,
} from '@nxt/backend/testing'

import {
    type Clock,
    createDeckController,
    type DeckDisplay,
    type Feedback,
    type KeyAppearance,
} from '~/controller'
import type { DeckConnectionState, DeckConvex } from '~/lib/convex'

// The backend harness is shared with every adapter; this file adds only the
// deck-specific fakes: a subscription-capable client over the in-memory
// backend, a fake clock, and a display that records what each key shows.
export { createTestBackend, readActivityLog, readQueue, seedCommunity }
export type { SeedParticipant, TestBackend }

// Pair a deck the way the plugin and the dashboard do, and return its secret.
export async function pairDeck(backend: TestBackend, ownerId: string) {
    const { code, pollToken } = await backend.mutation(
        api.pairedDecks.startPairing,
        {}
    )
    await backend
        .withIdentity({ subject: ownerId })
        .mutation(api.pairedDecks.approvePairing, { code, name: 'Deck' })
    const polled = await backend.mutation(api.pairedDecks.pollPairing, {
        pollToken,
    })
    if (polled.kind !== 'approved') throw new Error('pairing failed')
    return polled.secret
}

export async function revokeOnlyDeck(backend: TestBackend, ownerId: string) {
    const owner = backend.withIdentity({ subject: ownerId })
    const [deck] = await owner.query(api.pairedDecks.list, {})
    if (!deck) throw new Error('no Paired deck')
    await owner.mutation(api.pairedDecks.revoke, { id: deck.id })
}

type Subscription = {
    // biome-ignore lint/suspicious/noExplicitAny: any public query
    query: any
    args: unknown
    callback: (result: unknown) => unknown
    onError?: (error: Error) => unknown
}

/**
 * A `DeckConvex` over the in-memory backend. convex-test has no live
 * queries, so subscriptions re-run after every mutation sent through this
 * client and on `refresh()` (for changes made elsewhere, like the dashboard).
 * While offline, nothing is delivered and mutations are refused.
 */
export function fakeDeckConvex(backend: TestBackend) {
    const subscriptions = new Set<Subscription>()
    const connectionListeners = new Set<(s: DeckConnectionState) => void>()
    let connected = true
    let pending: Promise<unknown>[] = []
    let cannedReply: { value: unknown } | null = null

    const deliver = (subscription: Subscription) => {
        if (!connected) return
        const run = backend
            .query(subscription.query, subscription.args as never)
            .then(
                (result) => {
                    if (subscriptions.has(subscription) && connected) {
                        subscription.callback(result)
                    }
                },
                (error: Error) => subscription.onError?.(error)
            )
        pending.push(run)
    }

    const refreshAll = () => {
        for (const subscription of subscriptions) deliver(subscription)
    }

    const convex: DeckConvex = {
        onUpdate(query, args, callback, onError) {
            const subscription: Subscription = {
                query,
                args,
                callback: callback as (result: unknown) => unknown,
                onError,
            }
            subscriptions.add(subscription)
            deliver(subscription)
            return () => {
                subscriptions.delete(subscription)
            }
        },
        async mutation(mutation, args) {
            if (!connected) throw new Error('offline')
            if (cannedReply) {
                const { value } = cannedReply
                cannedReply = null
                if (value instanceof Error) throw value
                return value as never
            }
            const send = backend.mutation as (
                ref: unknown,
                args: unknown
            ) => Promise<never>
            const result = await send(mutation, args)
            refreshAll()
            return result
        },
        connectionState: () => ({ isWebSocketConnected: connected }),
        subscribeToConnectionState(callback) {
            connectionListeners.add(callback)
            return () => {
                connectionListeners.delete(callback)
            }
        },
    }

    return {
        convex,
        /** Re-deliver every live subscription and wait for it to land. */
        async refresh() {
            refreshAll()
            await this.settle()
        },
        /** Wait until every in-flight delivery has reached the controller. */
        async settle() {
            while (pending.length > 0) {
                const batch = pending
                pending = []
                await Promise.all(batch)
            }
        },
        /**
         * Answer the next mutation with `value` (or throw it, if an Error)
         * without touching the backend. Only for results the real backend
         * can't produce on demand, such as a failed request.
         */
        replyOnce(value: unknown) {
            cannedReply = { value }
        },
        /** Fail every live subscription, as a server-side query error would. */
        failSubscriptions(error: Error) {
            for (const subscription of subscriptions) {
                subscription.onError?.(error)
            }
        },
        setConnected(value: boolean) {
            connected = value
            for (const listener of connectionListeners) {
                listener({ isWebSocketConnected: value })
            }
            if (value) refreshAll()
        },
        get subscriptionCount() {
            return subscriptions.size
        },
    }
}

/** A clock that moves only when told to, firing due timers as it goes. */
export function fakeClock(start = Date.now()) {
    let now = start
    let timers: { at: number; callback: () => void }[] = []
    const clock: Clock = {
        now: () => now,
        setTimeout(callback, ms) {
            const timer = { at: now + ms, callback }
            timers.push(timer)
            return () => {
                timers = timers.filter((t) => t !== timer)
            }
        },
    }
    return {
        clock,
        advance(ms: number) {
            const target = now + ms
            for (;;) {
                const due = timers
                    .filter((t) => t.at <= target)
                    .sort((a, b) => a.at - b.at)[0]
                if (!due) break
                timers = timers.filter((t) => t !== due)
                now = due.at
                due.callback()
            }
            now = target
        },
    }
}

/** A display that keeps the latest appearance of each key and every feedback. */
export function recordingDisplay() {
    const keys = new Map<string, KeyAppearance>()
    const feedback: { key: string; feedback: Feedback }[] = []
    const display: DeckDisplay = {
        render: (key, appearance) => {
            keys.set(key, appearance)
        },
        feedback: (key, value) => {
            feedback.push({ key, feedback: value })
        },
    }
    return { display, keys, feedback }
}

/**
 * The real deck controller wired to the in-memory backend, a fake clock and a
 * recording display. `press` waits for the result and the live update.
 */
export async function deck(
    backend: TestBackend,
    options: { secret: string | null }
) {
    const client = fakeDeckConvex(backend)
    const time = fakeClock()
    const screen = recordingDisplay()
    const unpairedCalls: number[] = []
    const controller = createDeckController({
        convex: client.convex,
        display: screen.display,
        clock: time.clock,
        onUnpaired: () => unpairedCalls.push(time.clock.now()),
    })
    controller.setSecret(options.secret)
    await client.settle()

    return {
        controller,
        client,
        time,
        unpairedCalls,
        feedback: screen.feedback,
        /** What a key currently shows. */
        key(id: string) {
            const appearance = screen.keys.get(id)
            if (!appearance) throw new Error(`key ${id} never rendered`)
            return appearance
        },
        async press(id: string) {
            await controller.press(id)
            await client.settle()
        },
    }
}
