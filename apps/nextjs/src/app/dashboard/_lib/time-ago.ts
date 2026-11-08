'use client'

import { useEffect, useState } from 'react'

function computeTimeAgo(timestamp: number): string {
    const ms = Math.max(0, Date.now() - timestamp)
    const minutes = Math.floor(ms / 60_000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'just now'
    if (hours < 1) return `${minutes}m ago`
    if (days < 1) return `${hours}h ago`
    return `${days}d ago`
}

export function useTimeAgo(timestamp: number) {
    const [value, setValue] = useState(() => computeTimeAgo(timestamp))

    useEffect(() => {
        setValue(computeTimeAgo(timestamp))
        const id = window.setInterval(
            () => setValue(computeTimeAgo(timestamp)),
            30_000
        )
        return () => window.clearInterval(id)
    }, [timestamp])

    return value
}
