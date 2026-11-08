// How many Participants one deck Ping may call, shared by the deck functions,
// which clamp to it, and the Stream Deck plugin, which caps a Ping key's
// count setting to it. `Queue.ping` itself has no cap.

/** A deck Ping calls at most this many. */
export const MAX_DECK_PING = 10

/** A requested Ping count as a whole number from 1 to `MAX_DECK_PING`. */
export function clampPingCount(count: number) {
    if (!Number.isFinite(count)) return 1
    return Math.min(MAX_DECK_PING, Math.max(1, Math.floor(count)))
}
