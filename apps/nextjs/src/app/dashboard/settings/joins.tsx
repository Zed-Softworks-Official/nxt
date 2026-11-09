'use client'

import { api } from '@nxt/backend/api'
import { useMutation, useQuery } from '@nxt/backend/react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

const PLATFORM_NAMES = {
    discord: 'Discord',
    twitch: 'Twitch',
    youtube: 'YouTube',
} as const

export function Joins() {
    const links = useQuery(api.platformLinks.joinSettings, {})
    const setJoins = useMutation(api.platformLinks.setJoins)
    const [saving, setSaving] = useState(false)

    if (links === undefined) return <JoinsSkeleton />
    // Nothing to switch without a Platform Link.
    if (links.length === 0) return null

    async function toggle(link: NonNullable<typeof links>[number]) {
        setSaving(true)
        try {
            const result = await setJoins({
                platform: link.platform,
                platformId: link.platformId,
                on: !link.joins,
            })
            if (result.kind === 'unlinked') {
                toast.error('That platform is no longer linked.')
            }
        } catch {
            toast.error("Couldn't change Joins. Try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <JoinsHeader />
            <CardContent className="flex flex-col gap-3">
                <span className="text-sm text-muted-foreground">
                    With Joins off, nobody can join from that platform, Admins
                    included. People already waiting keep their place.
                </span>
                {links.map((link) => (
                    <div
                        className="flex items-center justify-between gap-2"
                        key={`${link.platform}:${link.platformId}`}
                    >
                        <span className="text-sm">
                            {PLATFORM_NAMES[link.platform]}:{' '}
                            {link.joins ? 'on' : 'off'}
                        </span>
                        <Button
                            disabled={saving}
                            onClick={() => void toggle(link)}
                            variant="outline"
                        >
                            Turn {link.joins ? 'off' : 'on'}
                        </Button>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

function JoinsHeader() {
    return (
        <CardHeader>
            <CardTitle>Joins</CardTitle>
        </CardHeader>
    )
}

export function JoinsSkeleton() {
    return (
        <Card aria-busy="true">
            <JoinsHeader />
            <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-9 w-full" />
            </CardContent>
        </Card>
    )
}
