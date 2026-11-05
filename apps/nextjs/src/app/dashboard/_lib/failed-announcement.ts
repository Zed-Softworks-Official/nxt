'use client'

import { useEffect, useState } from 'react'

// An Announcement still pending after this long is a Failed Announcement
// (ADR-0004). This one rule covers failed posts and a bot that is down.
const FAILED_AFTER_MS = 30_000

export function isAnnouncementFailed(
    participant: { announcementPendingSince?: number },
    now: number | null
) {
    const since = participant.announcementPendingSince
    return now !== null && since !== undefined && now - since >= FAILED_AFTER_MS
}

// The current time, updated every second. Null until mounted, so the server
// and first client render agree.
export function useNow() {
    const [now, setNow] = useState<number | null>(null)

    useEffect(() => {
        setNow(Date.now())
        const id = window.setInterval(() => setNow(Date.now()), 1_000)
        return () => window.clearInterval(id)
    }, [])

    return now
}
