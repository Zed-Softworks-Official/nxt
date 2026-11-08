import { api } from '@nxt/backend/api'
import { pairingLink } from '@nxt/backend/pairingLink'
import type {
    FunctionArgs,
    FunctionReference,
    FunctionReturnType,
} from 'convex/server'

import type { Clock } from '~/controller'

// Pairing a deck (ADR-0006), with no Stream Deck SDK types: start a pairing
// request, show its code and approval link, and poll until the owner
// approves it on the dashboard. The secret goes only to `onSecret`; the
// statuses the Property Inspector sees never carry it.

export type PairingStatus =
    | { status: 'idle' }
    | { status: 'starting' }
    | { status: 'waiting'; code: string; url: string; expiresAt: number }
    | { status: 'paired' }
    // Couldn't reach Nxt to get a code; retrying.
    | { status: 'error' }

export type PairingConvex = {
    mutation<Mutation extends FunctionReference<'mutation', 'public'>>(
        mutation: Mutation,
        args: FunctionArgs<Mutation>
    ): Promise<FunctionReturnType<Mutation>>
}

/** How often a waiting plugin asks whether its code was approved. */
export const POLL_EVERY_MS = 2_000

export function createPairingFlow(deps: {
    convex: PairingConvex
    clock: Clock
    dashboardOrigin: string
    onChange: (status: PairingStatus) => void
    onSecret: (secret: string) => void
}) {
    let status: PairingStatus = { status: 'idle' }
    // Bumped whenever pairing starts over or stops, so late replies from an
    // earlier attempt are dropped.
    let attempt = 0
    let cancelTimer: (() => void) | null = null

    function set(next: PairingStatus) {
        status = next
        deps.onChange(next)
    }

    function later(run: () => void) {
        cancelTimer?.()
        cancelTimer = deps.clock.setTimeout(run, POLL_EVERY_MS)
    }

    async function begin(current: number, deviceName: string | undefined) {
        if (status.status !== 'error') set({ status: 'starting' })
        let started: FunctionReturnType<typeof api.pairedDecks.startPairing>
        try {
            started = await deps.convex.mutation(
                api.pairedDecks.startPairing,
                {}
            )
        } catch {
            if (current !== attempt) return
            set({ status: 'error' })
            later(() => void begin(current, deviceName))
            return
        }
        if (current !== attempt) return
        set({
            status: 'waiting',
            code: started.code,
            url: pairingLink(deps.dashboardOrigin, {
                code: started.code,
                name: deviceName,
            }),
            expiresAt: started.expiresAt,
        })
        later(() => void poll(current, started.pollToken, deviceName))
    }

    async function poll(
        current: number,
        pollToken: string,
        deviceName: string | undefined
    ) {
        let polled: FunctionReturnType<typeof api.pairedDecks.pollPairing>
        try {
            polled = await deps.convex.mutation(api.pairedDecks.pollPairing, {
                pollToken,
            })
        } catch {
            // Keep showing the code; the next poll may get through.
            if (current === attempt) {
                later(() => void poll(current, pollToken, deviceName))
            }
            return
        }
        if (current !== attempt) return
        if (polled.kind === 'approved') {
            attempt++
            set({ status: 'paired' })
            deps.onSecret(polled.secret)
            return
        }
        if (polled.kind === 'pending') {
            later(() => void poll(current, pollToken, deviceName))
            return
        }
        // Expired, or forgotten by the backend: show a fresh code.
        await begin(current, deviceName)
    }

    return {
        /** Show a code to approve, replacing any earlier one. */
        start(deviceName?: string) {
            attempt++
            cancelTimer?.()
            void begin(attempt, deviceName)
        },
        /** Stop pairing and forget the code. */
        stop() {
            attempt++
            cancelTimer?.()
            cancelTimer = null
            set({ status: 'idle' })
        },
        /** The deck has a secret already, from an earlier pairing. */
        markPaired() {
            attempt++
            cancelTimer?.()
            cancelTimer = null
            set({ status: 'paired' })
        },
        status: () => status,
    }
}
