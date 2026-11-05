'use client'

import { api } from '@nxt/backend/api'
import { useMutation } from '@nxt/backend/react'
import { toast } from 'sonner'

type TurnTarget = { reference: number; username: string }
type TurnResult = { kind: 'ok' | 'unknown_reference' | 'wrong_state' }

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
function reportTurn(result: TurnResult | null, target: TurnTarget) {
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

    return {
        ping: async (count: number) => {
            const result = await attempt('ping', () => pingMutation({ count }))
            if (!result) return
            if (result.kind === 'empty') {
                toast.info('No one is waiting.')
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
        open: () => attempt('resume the Queue', () => openMutation({})),
        pause: () => attempt('pause the Queue', () => pauseMutation({})),
        play: async (target: TurnTarget) => {
            const result = await attempt(
                `move @${target.username} to Playing`,
                () => playMutation({ reference: target.reference })
            )
            reportTurn(result, target)
        },
        returnToQueue: async (target: TurnTarget) => {
            const result = await attempt(
                `return @${target.username} to the Queue`,
                () => returnMutation({ reference: target.reference })
            )
            reportTurn(result, target)
        },
        done: async (target: TurnTarget) => {
            const result = await attempt(
                `finish @${target.username}'s turn`,
                () => doneMutation({ reference: target.reference })
            )
            reportTurn(result, target)
        },
    }
}
