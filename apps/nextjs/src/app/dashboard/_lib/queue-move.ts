import type { MoveTo } from './queue-actions'

// The relative Move for dropping the `active` waiting Participant onto the
// `over` row, given the Queue's references front to back.
export function moveForDrop(
    order: readonly number[],
    active: number,
    over: number
): MoveTo | null {
    const from = order.indexOf(active)
    const to = order.indexOf(over)
    if (from === -1 || to === -1 || from === to) return null
    if (to === 0) return { toFront: true }
    if (to > from) return { after: over }
    const above = order[to - 1]
    return above === undefined ? null : { after: above }
}

// The waiting list as it will look once the Move lands, for the optimistic
// update. Null when the Move can't apply here, so the view is left alone and
// the server's answer decides.
export function reorderWaiting<T extends { reference: number }>(
    waiting: readonly T[],
    reference: number,
    to: MoveTo
): T[] | null {
    const target = waiting.find((row) => row.reference === reference)
    if (!target) return null
    const others = waiting.filter((row) => row !== target)
    if ('toFront' in to) return [target, ...others]
    const above = others.findIndex((row) => row.reference === to.after)
    if (above === -1) return null
    return [...others.slice(0, above + 1), target, ...others.slice(above + 1)]
}
