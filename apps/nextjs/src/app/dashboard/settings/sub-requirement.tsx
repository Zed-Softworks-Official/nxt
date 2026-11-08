'use client'

import { api } from '@nxt/backend/api'
import { useAction, useQuery } from '@nxt/backend/react'
import {
    type SubRequirement as Requirement,
    SUB_REQUIREMENT_LABELS,
    SUB_REQUIREMENTS,
} from '@nxt/backend/subRequirement'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

import { TwitchConnection } from '../connections/connection'

export function SubRequirement() {
    const settings = useQuery(api.subRequirement.settings, {})
    if (settings === undefined) return <SubRequirementSkeleton />
    // Nothing to restrict without a linked Twitch channel.
    if (settings === null) return null
    return <SubRequirementForm {...settings} />
}

function SubRequirementForm(props: {
    requirement: Requirement
    needsReconnect: boolean
}) {
    const set = useAction(api.subRequirement.set)
    const [saving, setSaving] = useState(false)

    async function choose(requirement: Requirement) {
        setSaving(true)
        try {
            const result = await set({ requirement })
            switch (result.kind) {
                case 'ok':
                    toast.success(
                        `Sub requirement set to ${SUB_REQUIREMENT_LABELS[requirement]}.`
                    )
                    break
                case 'unlinked':
                    toast.error('Link a Twitch channel first.')
                    break
                case 'needs_reconnect':
                    toast.error('Reconnect Twitch first.')
                    break
                case 'not_eligible':
                    toast.error(
                        "This channel can't have subs yet. It needs to be a Twitch Affiliate or Partner."
                    )
                    break
                case 'check_failed':
                    toast.error("Couldn't check this channel. Try again.")
                    break
            }
        } catch {
            toast.error("Couldn't change the Sub requirement. Try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <SubRequirementHeader />
            <CardContent className="flex flex-col gap-3">
                <span className="text-sm text-muted-foreground">
                    The minimum Twitch sub needed to join from Twitch chat. The
                    broadcaster and moderators are exempt, and people already
                    waiting keep their place.
                </span>
                {props.needsReconnect && (
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-destructive" role="alert">
                            {props.requirement === 'off'
                                ? 'Reconnect Twitch to use this.'
                                : "Nxt can't check subs, so Twitch joins are being refused. Reconnect Twitch, or turn this off."}
                        </span>
                        <TwitchConnection label="Reconnect" />
                    </div>
                )}
                {props.needsReconnect && props.requirement === 'off' ? null : (
                    <div className="flex flex-wrap gap-2">
                        {SUB_REQUIREMENTS.map((requirement) => (
                            <Button
                                key={requirement}
                                aria-pressed={props.requirement === requirement}
                                disabled={
                                    saving ||
                                    // A revoked grant can only be turned off.
                                    (props.needsReconnect &&
                                        requirement !== 'off')
                                }
                                onClick={() => void choose(requirement)}
                                variant={
                                    props.requirement === requirement
                                        ? 'default'
                                        : 'outline'
                                }
                            >
                                {SUB_REQUIREMENT_LABELS[requirement]}
                            </Button>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function SubRequirementHeader() {
    return (
        <CardHeader>
            <CardTitle>Sub requirement</CardTitle>
        </CardHeader>
    )
}

export function SubRequirementSkeleton() {
    return (
        <Card aria-busy="true">
            <SubRequirementHeader />
            <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-9 w-full" />
            </CardContent>
        </Card>
    )
}
