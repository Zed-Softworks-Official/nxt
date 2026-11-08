'use client'

import { isAnnouncementFailed as failedSince } from '@nxt/backend/failedAnnouncement'
import { useEffect, useState } from 'react'

// The same Failed Announcement rule the Stream Deck plugin uses (ADR-0004).
export function isAnnouncementFailed(
    participant: { announcementPendingSince?: number },
    now: number | null
) {
    return failedSince(participant.announcementPendingSince, now)
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
