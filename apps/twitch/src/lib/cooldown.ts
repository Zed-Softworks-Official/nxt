// In-memory, per-key cooldown. Keys that were last let through more than
// `windowMs` ago are let through again. State is lost on restart, which is fine
// for flood control.
export function createCooldown(windowMs: number, now: () => number) {
    const lastAllowed = new Map<string, number>()
    return {
        // Returns true and starts the window if `key` is not cooling down.
        tryUse(key: string): boolean {
            const at = now()
            const last = lastAllowed.get(key)
            if (last !== undefined && at - last < windowMs) return false
            lastAllowed.set(key, at)
            // Drop expired keys so the map does not grow without bound.
            for (const [other, time] of lastAllowed) {
                if (at - time >= windowMs) lastAllowed.delete(other)
            }
            return true
        },
    }
}
