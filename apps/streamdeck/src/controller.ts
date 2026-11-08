import { api } from '@nxt/backend/api'
import {
    FAILED_AFTER_MS,
    isAnnouncementFailed,
} from '@nxt/backend/failedAnnouncement'
import type { FunctionReturnType } from 'convex/server'

import type { DeckConvex } from '~/lib/convex'

// The deck controller: everything a Paired deck's keys do, with no Stream
// Deck SDK types (spec #20). Inputs are the deck's secret, the visible keys
// with their action and settings, key presses, the client's live deck view
// and connection state, and a clock. Outputs are each key's appearance and
// press feedback through a `DeckDisplay`, and the deck mutations it sends.
// The SDK adapter maps its events onto this and these outputs onto
// setTitle/setImage/showOk/showAlert.

type DeckView = FunctionReturnType<typeof api.deck.view>
type LiveView = Extract<DeckView, { kind: 'ok' }>

export type DeckAction =
    | 'ping'
    | 'openPause'
    | 'play'
    | 'return'
    | 'done'
    | 'waitingCount'
    | 'pingedCount'

export type KeyIcon =
    | 'ping'
    | 'open'
    | 'paused'
    | 'play'
    | 'return'
    | 'done'
    | 'waiting'
    | 'pinged'
export type Platform = 'discord' | 'twitch' | 'youtube'

export type KeyAppearance = {
    connection: 'live' | 'offline' | 'unpaired'
    icon: KeyIcon
    title: string
    platform: Platform | null
    dimmed: boolean
    warning: boolean
}

export type Feedback = 'ok' | 'alert'

export type DeckDisplay = {
    render(key: string, appearance: KeyAppearance): void
    feedback(key: string, feedback: Feedback): void
}

export type Clock = {
    now(): number
    setTimeout(callback: () => void, ms: number): () => void
}

type Key = {
    action: DeckAction
    count: number
    slot: number
    // The reference a slot key last showed (null: empty; undefined: nothing
    // shown yet) and when that last changed, for the press guard.
    shown?: number | null
    changedAt: number
}

/** A slot key ignores presses this long after its Participant changes. */
export const PRESS_GUARD_MS = 1_000

const systemClock: Clock = {
    now: () => Date.now(),
    setTimeout(callback, ms) {
        const timer = setTimeout(callback, ms)
        return () => clearTimeout(timer)
    },
}

type SlotAction = 'play' | 'return' | 'done'

function isSlotAction(action: DeckAction): action is SlotAction {
    return action === 'play' || action === 'return' || action === 'done'
}

const baseIcons: Record<DeckAction, KeyIcon> = {
    ping: 'ping',
    openPause: 'open',
    play: 'play',
    return: 'return',
    done: 'done',
    waitingCount: 'waiting',
    pingedCount: 'pinged',
}

const slotCommands = {
    play: api.deck.play,
    return: api.deck.returnToQueue,
    done: api.deck.done,
} as const

/** Longest slot title that fits a key; longer names end in "…". */
export const SLOT_TITLE_MAX = 8

function cutOff(name: string) {
    const chars = Array.from(name)
    if (chars.length <= SLOT_TITLE_MAX) return name
    return `${chars.slice(0, SLOT_TITLE_MAX - 1).join('')}…`
}

type SlotParticipant = {
    reference: number
    name: string
    platform: Platform
    announcementPendingSince: number | null
}

// Play and Return act on Pinged slot k, Done on Playing slot k (1-based,
// join order, like the dashboard lists).
function slotParticipant(
    action: SlotAction,
    slot: number,
    live: LiveView
): SlotParticipant | undefined {
    if (action !== 'done') return live.pinged[slot - 1]
    const playing = live.playing[slot - 1]
    return playing && { ...playing, announcementPendingSince: null }
}

/** The most a deck Ping key calls at once (the backend clamps the same way). */
export const MAX_PING_COUNT = 10

// Key settings come from the Stream Deck untyped and stored in plain JSON,
// so read them defensively and fall back to defaults.
function wholeNumberSetting(
    settings: unknown,
    name: string,
    min: number,
    max: number
) {
    const raw =
        typeof settings === 'object' && settings !== null
            ? (settings as Record<string, unknown>)[name]
            : undefined
    const value = typeof raw === 'string' ? Number(raw) : raw
    if (typeof value !== 'number' || !Number.isFinite(value)) return min
    return Math.min(max, Math.max(min, Math.floor(value)))
}

export function createDeckController(deps: {
    convex: DeckConvex
    display: DeckDisplay
    clock?: Clock
    onUnpaired?: () => void
}) {
    const clock = deps.clock ?? systemClock
    const keys = new Map<string, Key>()
    // What each key last showed, so an unchanged key isn't redrawn.
    const drawn = new Map<string, string>()
    let view: LiveView | null = null
    let unsubscribe: (() => void) | null = null
    // The deck's secret; null while unpaired (none yet, or refused).
    let secret: string | null = null
    let cancelFailTimer: (() => void) | null = null
    let connected = deps.convex.connectionState().isWebSocketConnected
    const stopWatchingConnection = deps.convex.subscribeToConnectionState(
        (state) => {
            if (state.isWebSocketConnected === connected) return
            connected = state.isWebSocketConnected
            renderAll()
        }
    )

    // The view keys may act on: none while unpaired or offline, so a press
    // can't be queued by the client and land later on someone else.
    function liveView() {
        return connected ? view : null
    }

    function greyed(key: Key): KeyAppearance {
        const connection = secret === null ? 'unpaired' : 'offline'
        return {
            connection,
            icon: baseIcons[key.action],
            title: connection,
            platform: null,
            dimmed: true,
            warning: false,
        }
    }

    // The backend refused the secret (revoked or unknown). Forget it so
    // nothing more is sent, and tell the adapter so it can offer pairing.
    function becomeUnpaired() {
        if (secret === null) return
        unsubscribe?.()
        unsubscribe = null
        view = null
        secret = null
        renderAll()
        deps.onUnpaired?.()
    }

    // Send a deck mutation and report how it went on the key.
    async function send(
        id: string,
        run: (secret: string) => Promise<{ kind: string }>
    ) {
        if (secret === null) return
        let feedback: Feedback
        try {
            const result = await run(secret)
            if (result.kind === 'unpaired') becomeUnpaired()
            feedback =
                result.kind === 'ok' || result.kind === 'already'
                    ? 'ok'
                    : 'alert'
        } catch {
            feedback = 'alert'
        }
        deps.display.feedback(id, feedback)
    }

    function appearance(key: Key, live: LiveView): KeyAppearance {
        const base = {
            connection: 'live' as const,
            platform: null,
            dimmed: false,
            warning: false,
        }
        switch (key.action) {
            case 'waitingCount':
                return {
                    ...base,
                    icon: 'waiting',
                    title: String(live.waitingCount),
                }
            case 'pingedCount':
                return {
                    ...base,
                    icon: 'pinged',
                    title: String(live.pinged.length),
                }
            case 'ping':
                return {
                    ...base,
                    icon: 'ping',
                    title: `Ping ${key.count}`,
                    dimmed: live.waitingCount < key.count,
                }
            case 'openPause':
                return live.state === 'open'
                    ? { ...base, icon: 'open', title: 'Open' }
                    : { ...base, icon: 'paused', title: 'Paused' }
            case 'play':
            case 'return':
            case 'done': {
                const participant = slotParticipant(key.action, key.slot, live)
                if (!participant) {
                    return {
                        ...base,
                        icon: key.action,
                        title: '',
                        dimmed: true,
                    }
                }
                return {
                    ...base,
                    icon: key.action,
                    title: cutOff(participant.name),
                    platform: participant.platform,
                    warning: isAnnouncementFailed(
                        participant.announcementPendingSince,
                        clock.now()
                    ),
                }
            }
        }
    }

    function draw(id: string, appearance: KeyAppearance) {
        const fingerprint = JSON.stringify(appearance)
        if (drawn.get(id) === fingerprint) return
        drawn.set(id, fingerprint)
        deps.display.render(id, appearance)
    }

    function render(id: string) {
        const key = keys.get(id)
        if (!key) return
        const view = liveView()
        if (!view) return draw(id, greyed(key))
        if (isSlotAction(key.action)) {
            const reference =
                slotParticipant(key.action, key.slot, view)?.reference ?? null
            if (key.shown !== undefined && key.shown !== reference) {
                key.changedAt = clock.now()
            }
            key.shown = reference
        }
        draw(id, appearance(key, view))
    }

    function renderAll() {
        for (const id of keys.keys()) render(id)
        scheduleFailMark()
    }

    // A query result doesn't change as time passes, so re-render when the
    // next pending Announcement crosses the Failed Announcement line.
    function scheduleFailMark() {
        cancelFailTimer?.()
        cancelFailTimer = null
        if (!view) return
        const now = clock.now()
        const upcoming = view.pinged
            .map((slot) => slot.announcementPendingSince)
            .filter((since): since is number => since !== null)
            .map((since) => since + FAILED_AFTER_MS)
            .filter((at) => at > now)
        if (upcoming.length === 0) return
        cancelFailTimer = clock.setTimeout(
            renderAll,
            Math.min(...upcoming) - now
        )
    }

    return {
        setSecret(next: string | null) {
            unsubscribe?.()
            unsubscribe = null
            view = null
            secret = next
            renderAll()
            if (secret === null) return
            unsubscribe = deps.convex.onUpdate(
                api.deck.view,
                { secret },
                (result) => {
                    if (result.kind === 'unpaired') return becomeUnpaired()
                    view = result
                    renderAll()
                },
                // Don't trust a view that failed; the client keeps the
                // subscription and the next result brings the keys back.
                () => {
                    view = null
                    renderAll()
                }
            )
        },
        showKey(id: string, action: DeckAction, settings: unknown) {
            keys.set(id, {
                action,
                count: wholeNumberSetting(settings, 'count', 1, MAX_PING_COUNT),
                slot: wholeNumberSetting(
                    settings,
                    'slot',
                    1,
                    Number.MAX_SAFE_INTEGER
                ),
                changedAt: Number.NEGATIVE_INFINITY,
            })
            drawn.delete(id)
            render(id)
        },
        hideKey(id: string) {
            keys.delete(id)
            drawn.delete(id)
        },
        async press(id: string) {
            const key = keys.get(id)
            if (!key) return
            const view = liveView()
            if (!view) return deps.display.feedback(id, 'alert')
            switch (key.action) {
                case 'ping':
                    return await send(id, (secret) =>
                        deps.convex.mutation(api.deck.ping, {
                            secret,
                            count: key.count,
                        })
                    )
                case 'play':
                case 'return':
                case 'done': {
                    const participant = slotParticipant(
                        key.action,
                        key.slot,
                        view
                    )
                    if (!participant) return
                    if (clock.now() - key.changedAt < PRESS_GUARD_MS) return
                    const command = slotCommands[key.action]
                    return await send(id, (secret) =>
                        deps.convex.mutation(command, {
                            secret,
                            reference: participant.reference,
                        })
                    )
                }
                case 'openPause': {
                    const toggle =
                        view.state === 'open' ? api.deck.pause : api.deck.open
                    return await send(id, (secret) =>
                        deps.convex.mutation(toggle, { secret })
                    )
                }
            }
        },
        dispose() {
            stopWatchingConnection()
            cancelFailTimer?.()
            unsubscribe?.()
        },
    }
}
