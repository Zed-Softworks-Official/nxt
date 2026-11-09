'use client'

import { api } from '@nxt/backend/api'
import { useMutation } from '@nxt/backend/react'
import { toast } from 'sonner'
import { type RelativeMove, waitingAfterMove } from './queue-move'

// The Participant an action is for, by reference, named in its toasts.
type Target = { reference: number; username: string }
type TargetResult = { kind: 'ok' | 'unknown_reference' | 'wrong_state' }

// Convex hides server error details in production, so the toast names the
// action rather than showing the raw message.
async function attempt<T>(action: string, run: () => Promise<T>) {
    try {
        return await run()
    } catch (error) {
        console.error(`Failed to ${action}`, error)
        toast.error(`Couldn't ${action}. Try again.`)
        return null
    }
}

// Someone else, such as an Admin on Discord, can move a Participant first.
function reportRefusal(result: TargetResult | null, target: Target) {
    if (result && result.kind !== 'ok') {
        toast.info(`@${target.username} has already moved.`)
    }
}

// The dashboard's Queue actions, with toasts for anything that did not go as
// asked. Success has no toast because the lists update live.
export function useQueueActions() {
    const pingMutation = useMutation(api.queue.ping)
    const openMutation = useMutation(api.queue.open)
    const pauseMutation = useMutation(api.queue.pause)
    const playMutation = useMutation(api.queue.play)
    const returnMutation = useMutation(api.queue.returnToQueue)
    const doneMutation = useMutation(api.queue.done)
    const pingOneMutation = useMutation(api.queue.pingOne)
    const removeMutation = useMutation(api.queue.remove)
    // The Queue view shows the Move straight away. Convex drops the optimistic
    // view once the server answers, so a Move that did not happen snaps back.
    const moveMutation = useMutation(api.queue.move).withOptimisticUpdate(
        (store, args) => {
            const view = store.getQuery(api.queue.view, {})
            if (!view || 'position' in args.to) return
            const waiting = waitingAfterMove(
                view.waiting,
                args.reference,
                args.to
            )
            if (waiting)
                store.setQuery(api.queue.view, {}, { ...view, waiting })
        }
    )
    const clearMutation = useMutation(api.queue.clear)

    return {
        ping: async (count: number) => {
            const result = await attempt('ping', () => pingMutation({ count }))
            if (!result) return
            if (result.kind === 'empty') {
                toast.info('No one is waiting.')
                return
            }
            if (result.kind === 'note_too_long') {
                toast.error(
                    `The saved ping note is over ${result.max} characters. Shorten it in Settings.`
                )
                return
            }
            const pinged = result.pinged.length
            if (pinged < count) {
                const verb = pinged === 1 ? 'was' : 'were'
                toast.info(
                    `Only ${pinged} ${verb} waiting, so ${pinged} ${verb} pinged.`
                )
            }
        },
        // A targeted Ping with no typed note, so the Saved ping note is used.
        pingOne: async (target: Target) => {
            const result = await attempt(`ping @${target.username}`, () =>
                pingOneMutation({ reference: target.reference })
            )
            if (result?.kind === 'note_too_long') {
                toast.error(
                    `The saved ping note is over ${result.max} characters. Shorten it in Settings.`
                )
                return
            }
            reportRefusal(result, target)
        },
        clear: async () => {
            const result = await attempt('clear the Queue', () =>
                clearMutation({})
            )
            if (result?.kind === 'empty') toast.info('No one is waiting.')
        },
        open: () => attempt('resume the Queue', () => openMutation({})),
        pause: () => attempt('pause the Queue', () => pauseMutation({})),
        play: async (target: Target) => {
            const result = await attempt(
                `move @${target.username} to Playing`,
                () => playMutation({ reference: target.reference })
            )
            reportRefusal(result, target)
        },
        returnToQueue: async (target: Target) => {
            const result = await attempt(
                `return @${target.username} to the Queue`,
                () => returnMutation({ reference: target.reference })
            )
            reportRefusal(result, target)
        },
        done: async (target: Target) => {
            const result = await attempt(
                `finish @${target.username}'s turn`,
                () => doneMutation({ reference: target.reference })
            )
            reportRefusal(result, target)
        },
        move: async (target: Target, to: RelativeMove) => {
            const result = await attempt(`move @${target.username}`, () =>
                moveMutation({ reference: target.reference, to })
            )
            reportRefusal(result, target)
        },
        remove: async (target: Target) => {
            const result = await attempt(`remove @${target.username}`, () =>
                removeMutation({ reference: target.reference })
            )
            reportRefusal(result, target)
        },
    }
}
