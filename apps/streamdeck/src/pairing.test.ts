import { api } from '@nxt/backend/api'
import { readPairingLink } from '@nxt/backend/pairingLink'
import { afterEach, expect, test, vi } from 'vitest'

import { createPairingFlow, type PairingStatus, POLL_EVERY_MS } from '~/pairing'
import {
    createTestBackend,
    fakeClock,
    seedCommunity,
    type TestBackend,
} from '~/test/deckHarness'

const ORIGIN = 'https://nxt.example'

afterEach(() => {
    vi.useRealTimers()
})

async function setup() {
    const backend = createTestBackend()
    await seedCommunity(backend, { ownerId: 'owner-1', state: 'open' })
    const time = fakeClock()
    const statuses: PairingStatus[] = []
    const secrets: string[] = []
    // How many of the next backend calls fail, as a dropped connection would.
    const failures = { next: 0 }
    const flow = createPairingFlow({
        convex: {
            mutation: async (ref, args) => {
                if (failures.next > 0) {
                    failures.next--
                    throw new Error('Connection lost')
                }
                return await (
                    backend.mutation as (
                        ref: unknown,
                        args: unknown
                    ) => Promise<never>
                )(ref, args)
            },
        },
        clock: time.clock,
        dashboardOrigin: ORIGIN,
        onChange: (status) => statuses.push(status),
        onSecret: (secret) => secrets.push(secret),
    })
    const latest = () => statuses.at(-1)
    const waitForCode = async () => {
        await vi.waitFor(() => expect(latest()?.status).toBe('waiting'))
        const status = latest()
        if (status?.status !== 'waiting') throw new Error('not waiting')
        return status
    }
    // Move the clock, then let the backend calls it set off finish.
    const tick = async (ms: number) => {
        time.advance(ms)
        await new Promise((resolve) => setTimeout(resolve, 20))
    }
    return {
        backend,
        failures,
        time,
        tick,
        flow,
        statuses,
        secrets,
        latest,
        waitForCode,
    }
}

async function approve(backend: TestBackend, code: string) {
    return await backend
        .withIdentity({ subject: 'owner-1' })
        .mutation(api.pairedDecks.approvePairing, { code, name: 'Desk' })
}

test('starting shows a code and a dashboard link carrying the code and device name', async () => {
    const { flow, waitForCode } = await setup()

    flow.start('Stream Deck XL')
    const waiting = await waitForCode()

    expect(waiting.code).toMatch(/^[A-Z0-9]{8}$/)
    const url = new URL(waiting.url)
    expect(url.origin).toBe(ORIGIN)
    expect(
        readPairingLink({
            code: url.searchParams.get('code') ?? undefined,
            name: url.searchParams.get('name') ?? undefined,
        })
    ).toEqual({ code: waiting.code, name: 'Stream Deck XL' })
})

test('the plugin notices the approval by itself and receives the secret once', async () => {
    const { backend, tick, flow, secrets, latest, waitForCode, statuses } =
        await setup()
    flow.start('Desk')
    const { code } = await waitForCode()

    await tick(POLL_EVERY_MS)
    expect(latest()?.status).toBe('waiting')

    expect(await approve(backend, code)).toEqual({ kind: 'ok' })
    await tick(POLL_EVERY_MS)

    await vi.waitFor(() => expect(latest()).toEqual({ status: 'paired' }))
    expect(secrets).toHaveLength(1)
    await tick(POLL_EVERY_MS * 5)
    expect(secrets).toHaveLength(1)
    // What the Property Inspector sees never carries the secret.
    expect(JSON.stringify(statuses)).not.toContain(secrets[0])
})

test('an expired code is replaced with a fresh one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { backend, tick, flow, latest, waitForCode, secrets } = await setup()
    flow.start('Desk')
    const first = await waitForCode()

    vi.setSystemTime(Date.now() + 11 * 60 * 1000)
    await tick(POLL_EVERY_MS)

    await vi.waitFor(() =>
        expect(latest()).toMatchObject({
            status: 'waiting',
            code: expect.not.stringMatching(first.code),
        })
    )
    const fresh = await waitForCode()
    expect(await approve(backend, first.code)).toEqual({ kind: 'expired' })
    expect(await approve(backend, fresh.code)).toEqual({ kind: 'ok' })
    await tick(POLL_EVERY_MS)
    await vi.waitFor(() => expect(latest()).toEqual({ status: 'paired' }))
    expect(secrets).toHaveLength(1)
})

test('a failed request is retried, and pairing carries on', async () => {
    const { backend, failures, tick, flow, latest, waitForCode } = await setup()
    failures.next = 1
    flow.start('Desk')

    await vi.waitFor(() => expect(latest()).toEqual({ status: 'error' }))
    await tick(POLL_EVERY_MS)
    const { code } = await waitForCode()

    failures.next = 1
    await approve(backend, code)
    await tick(POLL_EVERY_MS)
    expect(latest()).toMatchObject({ status: 'waiting', code })
    await tick(POLL_EVERY_MS)
    await vi.waitFor(() => expect(latest()).toEqual({ status: 'paired' }))
})

test('stopping drops the code, and a late approval of it is never collected', async () => {
    const { backend, tick, flow, latest, waitForCode, secrets } = await setup()
    flow.start('Desk')
    const { code } = await waitForCode()

    flow.stop()
    expect(latest()).toEqual({ status: 'idle' })
    await approve(backend, code)
    await tick(POLL_EVERY_MS * 3)

    expect(latest()).toEqual({ status: 'idle' })
    expect(secrets).toEqual([])
})

test('starting again while waiting replaces the code', async () => {
    const { tick, flow, latest, waitForCode, statuses } = await setup()
    flow.start('Desk')
    const first = await waitForCode()

    flow.start('Desk')
    await vi.waitFor(() =>
        expect(latest()).toMatchObject({
            status: 'waiting',
            code: expect.not.stringMatching(first.code),
        })
    )
    const seen = statuses.length
    await tick(POLL_EVERY_MS)
    // Only the new request is polled: nothing changes until it's approved.
    expect(statuses.length).toBe(seen)
})

test('a deck that is already paired shows paired and stops any pairing', async () => {
    const { backend, tick, flow, latest, waitForCode, secrets } = await setup()
    flow.start('Desk')
    const { code } = await waitForCode()

    flow.markPaired()
    await approve(backend, code)
    await tick(POLL_EVERY_MS * 3)

    expect(latest()).toEqual({ status: 'paired' })
    expect(secrets).toEqual([])
})
