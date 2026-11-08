import { api } from '@nxt/backend/api'
import { MAX_DECK_PING } from '@nxt/backend/deckPing'
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
export type Platform = LiveView['playing'][number]['platform']

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

export const systemClock: Clock = {
    now: () => Date.now(),
    setTimeout(callback, ms) {
        const timer = setTimeout(callback, ms)
        return () => clearTimeout(timer)
    },
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

// What a live key shows, over a plain undimmed key with no platform.
type Look = Pick<KeyAppearance, 'icon' | 'title'> &
    Partial<Pick<KeyAppearance, 'platform' | 'dimmed' | 'warning'>>

// A press as a deck mutation to send with the secret.
type Send = (secret: string) => Promise<{ kind: string }>

// Everything that differs between deck actions.
type ActionSpec = {
    /** The icon a greyed (unpaired or offline) key shows. */
    icon: KeyIcon
    /** Slot keys only: the Participant in slot `slot` (1-based, join order). */
    slot?: (live: LiveView, slot: number) => SlotParticipant | undefined
    look: (key: Key, live: LiveView, now: number) => Look
    /** What a press sends; null ignores the press. Counters have none. */
    press?: (key: Key, live: LiveView, convex: DeckConvex) => Send | null
}

// Play and Return act on Pinged slot k, Done on Playing slot k, like the
// dashboard's lists.
function slotAction(
    icon: 'play' | 'return' | 'done',
    list: 'pinged' | 'playing',
    command:
        | typeof api.deck.play
        | typeof api.deck.returnToQueue
        | typeof api.deck.done
): ActionSpec {
    const slot = (live: LiveView, k: number): SlotParticipant | undefined => {
        const entry = live[list][k - 1]
        return entry && { announcementPendingSince: null, ...entry }
    }
    return {
        icon,
        slot,
        look(key, live, now) {
            const participant = slot(live, key.slot)
            if (!participant) return { icon, title: '', dimmed: true }
            return {
                icon,
                title: cutOff(participant.name),
                platform: participant.platform,
                warning: isAnnouncementFailed(
                    participant.announcementPendingSince,
                    now
                ),
            }
        },
        press(key, live, convex) {
            const participant = slot(live, key.slot)
            if (!participant) return null
            return (secret) =>
                convex.mutation(command, {
                    secret,
                    reference: participant.reference,
                })
        },
    }
}

const actions: Record<DeckAction, ActionSpec> = {
    waitingCount: {
        icon: 'waiting',
        look: (_key, live) => ({
            icon: 'waiting',
            title: String(live.waitingCount),
        }),
    },
    pingedCount: {
        icon: 'pinged',
        look: (_key, live) => ({
            icon: 'pinged',
            title: String(live.pinged.length),
        }),
    },
    ping: {
        icon: 'ping',
        look: (key, live) => ({
            icon: 'ping',
            title: `Ping ${key.count}`,
            dimmed: live.waitingCount < key.count,
        }),
        press: (key, _live, convex) => (secret) =>
            convex.mutation(api.deck.ping, { secret, count: key.count }),
    },
    openPause: {
        icon: 'open',
        look: (_key, live) =>
            live.state === 'open'
                ? { icon: 'open', title: 'Open' }
                : { icon: 'paused', title: 'Paused' },
        press(_key, live, convex) {
            const toggle =
                live.state === 'open' ? api.deck.pause : api.deck.open
            return (secret) => convex.mutation(toggle, { secret })
        },
    },
    play: slotAction('play', 'pinged', api.deck.play),
    return: slotAction('return', 'pinged', api.deck.returnToQueue),
    done: slotAction('done', 'playing', api.deck.done),
}

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
            icon: actions[key.action].icon,
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
        return {
            connection: 'live',
            platform: null,
            dimmed: false,
            warning: false,
            ...actions[key.action].look(key, live, clock.now()),
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
        const slot = actions[key.action].slot
        if (slot) {
            const reference = slot(view, key.slot)?.reference ?? null
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
                count: wholeNumberSetting(settings, 'count', 1, MAX_DECK_PING),
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
            const action = actions[key.action]
            const run = action.press?.(key, view, deps.convex)
            if (!run) return
            if (action.slot && clock.now() - key.changedAt < PRESS_GUARD_MS) {
                return
            }
            return await send(id, run)
        },
        dispose() {
            stopWatchingConnection()
            cancelFailTimer?.()
            unsubscribe?.()
        },
    }
}
