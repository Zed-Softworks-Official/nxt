import type { api } from '@nxt/backend/api'
import type { FunctionArgs, FunctionReturnType } from '@nxt/backend/react'

// A waiting Participant as the dashboard's Queue view shows them.
export type WaitingParticipant = NonNullable<
    FunctionReturnType<typeof api.queue.view>
>['waiting'][number]

// Where a dashboard Move puts a waiting Participant: the front, or after the
// neighbour above (with the neighbour below as a second anchor).
export type RelativeMove = Exclude<
    FunctionArgs<typeof api.queue.move>['to'],
    { position: number }
>

// The relative Move for dropping the `active` waiting Participant onto the
// `over` row, given the Queue's references front to back.
export function moveForDrop(
    order: readonly number[],
    active: number,
    over: number
): RelativeMove | null {
    const from = order.indexOf(active)
    const to = order.indexOf(over)
    if (from === -1 || to === -1 || from === to) return null
    if (to === 0) return { toFront: true }
    // Dragged down, the row lands after `over`; dragged up, before it.
    const [after, before] =
        to > from ? [over, order[to + 1]] : [order[to - 1], over]
    if (after === undefined) return null
    return before === undefined ? { after } : { after, before }
}

// The waiting list as it will look once the Move lands, for the optimistic
// update. Null when the Move can't apply here, so the view is left alone and
// the server's answer decides.
export function waitingAfterMove<T extends { reference: number }>(
    waiting: readonly T[],
    reference: number,
    to: RelativeMove
): T[] | null {
    const target = waiting.find((row) => row.reference === reference)
    if (!target) return null
    const others = waiting.filter((row) => row !== target)
    if ('toFront' in to) return [target, ...others]
    const above = others.findIndex((row) => row.reference === to.after)
    if (above !== -1) {
        return [
            ...others.slice(0, above + 1),
            target,
            ...others.slice(above + 1),
        ]
    }
    const below = others.findIndex((row) => row.reference === to.before)
    if (below === -1) return null
    return [...others.slice(0, below), target, ...others.slice(below)]
}
