// An Announcement still pending after this long is a Failed Announcement
// (ADR-0004). This one rule covers failed posts and a bot that is down. It is
// judged by the reader against its own clock, because a query result does not
// change just because time passes.
export const FAILED_AFTER_MS = 30_000

/** Whether an Announcement pending since `since` (null: none pending) has failed by `now`. */
export function isAnnouncementFailed(
    since: number | null | undefined,
    now: number | null
) {
    return (
        now !== null &&
        since !== null &&
        since !== undefined &&
        now - since >= FAILED_AFTER_MS
    )
}
