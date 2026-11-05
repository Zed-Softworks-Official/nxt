'use client'

import { api } from '@nxt/backend/api'
import { platformLabel } from '@nxt/backend/participant'
import { useQuery } from '@nxt/backend/react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { isAnnouncementFailed, useNow } from '../_lib/failed-announcement'

// Toasts once when Announcements newly fail while the dashboard is open, one
// updating toast per platform. Failures already there on load only get their
// row warning, and recovering has no toast.
export function FailedAnnouncementToasts() {
    const data = useQuery(api.queue.view, {})
    const now = useNow()
    const knownFailures = useRef<Set<number> | null>(null)

    useEffect(() => {
        if (!data || now === null) return

        const failed = data.pinged.filter((participant) =>
            isAnnouncementFailed(participant, now)
        )
        const known = knownFailures.current
        knownFailures.current = new Set(failed.map((p) => p.reference))
        if (!known) return

        const platforms = new Set(
            failed
                .filter((participant) => !known.has(participant.reference))
                .map((participant) => participant.platform)
        )
        for (const platform of platforms) {
            const count = failed.filter((p) => p.platform === platform).length
            const who = count === 1 ? '1 Participant' : `${count} Participants`
            toast.error(`Couldn't reach ${who} on ${platformLabel(platform)}`, {
                id: `failed-announcement-${platform}`,
                duration: 10_000,
            })
        }
    }, [data, now])

    return null
}
