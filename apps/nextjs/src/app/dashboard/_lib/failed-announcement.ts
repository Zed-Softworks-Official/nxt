'use client'

import { useEffect, useState } from 'react'

// The current time, updated every second, for judging Failed Announcements
// with `isAnnouncementFailed` from `@nxt/backend/failedAnnouncement`
// (ADR-0004). Null until mounted, so the server and first client render agree.
export function useNow() {
    const [now, setNow] = useState<number | null>(null)

    useEffect(() => {
        setNow(Date.now())
        const id = window.setInterval(() => setNow(Date.now()), 1_000)
        return () => window.clearInterval(id)
    }, [])

    return now
}
