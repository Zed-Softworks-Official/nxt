'use client'

import { api } from '@nxt/backend/api'
import { useQuery } from '@nxt/backend/react'
import { ListX, Timer, Users } from 'lucide-react'
import { type ComponentProps, useEffect, useState } from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '~/components/ui/empty'
import { Item, ItemContent, ItemGroup, ItemTitle } from '~/components/ui/item'
import { useQueueActions } from '../_lib/queue-actions'
import { PlatformBadge, ReferenceBadge } from './participant-badges'
import { ParticipantContextMenu } from './participant-context-menu'
import { ParticipantRowsSkeleton } from './skeletons'

export function Queue() {
    const [now, setNow] = useState<number | null>(null)

    useEffect(() => {
        setNow(Date.now())
        const intervalId = window.setInterval(() => {
            setNow(Date.now())
        }, 30_000)

        return () => window.clearInterval(intervalId)
    }, [])

    const data = useQuery(api.queue.view, {})

    if (!data) return <QueueSkeleton />

    const { waiting } = data

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Users className="size-5 text-chart-2" />
                    <CardTitle>Queue</CardTitle>
                    <div className="ml-auto flex items-center gap-2">
                        {waiting.length > 0 && (
                            <span className="rounded-full border border-chart-2/30 bg-chart-2/10 px-2 py-0.5 text-xs font-semibold text-chart-2">
                                {waiting.length}
                            </span>
                        )}
                        <ClearQueueButton waitingCount={waiting.length} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {waiting.length === 0 ? (
                    <Empty className="border py-8">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Users className="size-5 text-muted-foreground" />
                            </EmptyMedia>
                            <EmptyTitle className="text-base">
                                Queue is empty
                            </EmptyTitle>
                            <EmptyDescription>
                                Players will appear here when they join.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ItemGroup>
                        {waiting.map((participant, i) => (
                            <QueueRow
                                key={participant.reference}
                                participant={participant}
                                position={i + 1}
                                now={now}
                                backAfter={
                                    i === waiting.length - 1
                                        ? null
                                        : (waiting.at(-1)?.reference ?? null)
                                }
                            />
                        ))}
                    </ItemGroup>
                )}
            </CardContent>
        </Card>
    )
}

type WaitingParticipant = {
    reference: number
    username: string
    platform: ComponentProps<typeof PlatformBadge>['platform']
    joinedAt: number
}

// One waiting Participant's row, with its context menu.
function QueueRow(props: {
    participant: WaitingParticipant
    position: number
    now: number | null
    // Who Move to back goes after, or null when already at the back.
    backAfter: number | null
}) {
    const { participant } = props
    return (
        <ParticipantContextMenu
            participant={participant}
            state={{
                kind: 'waiting',
                atFront: props.position === 1,
                backAfter: props.backAfter,
            }}
        >
            <Item
                variant="outline"
                className="group border-border/60 bg-card/50 shadow-xs transition-all hover:border-primary/35 hover:bg-accent/30"
            >
                <ItemContent className="gap-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-chart-2/30 bg-chart-2/10 text-xs font-semibold text-chart-2">
                                {props.position}
                            </div>
                            <ReferenceBadge reference={participant.reference} />
                            <ItemTitle className="text-sm font-semibold">
                                {participant.username}
                            </ItemTitle>
                        </div>
                        <PlatformBadge platform={participant.platform} />
                    </div>
                    <div className="ml-10 flex items-center gap-2 text-muted-foreground">
                        <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-1 text-xs">
                            <Timer className="size-3.5" />
                            {formatElapsedTime(participant.joinedAt, props.now)}
                        </div>
                    </div>
                </ItemContent>
            </Item>
        </ParticipantContextMenu>
    )
}

// Clears every waiting Participant after a confirmation that says how many.
// Pinged and Playing Participants stay.
function ClearQueueButton(props: { waitingCount: number }) {
    const { clear } = useQueueActions()
    const count = props.waitingCount
    const who =
        count === 1 ? '1 waiting Participant' : `${count} waiting Participants`

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 px-2 text-xs"
                >
                    <ListX className="size-3" />
                    Clear Queue
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Clear the Queue?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This removes {who}. Pinged and Playing Participants
                        stay.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={() => clear()}
                    >
                        Clear Queue
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export function QueueSkeleton() {
    return (
        <Card aria-busy="true">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Users className="size-5 text-chart-2" />
                    <CardTitle>Queue</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <ParticipantRowsSkeleton rows={3} meta />
            </CardContent>
        </Card>
    )
}

function formatElapsedTime(joinedAtEpoch: number, now: number | null) {
    if (now === null) {
        return '...'
    }

    const elapsedMs = Math.max(0, now - joinedAtEpoch)
    const elapsedMinutes = Math.floor(elapsedMs / 60_000)
    const elapsedHours = Math.floor(elapsedMinutes / 60)
    const elapsedDays = Math.floor(elapsedHours / 24)

    if (elapsedMinutes < 1) {
        return '<1m'
    }

    if (elapsedHours < 1) {
        return `${elapsedMinutes}m`
    }

    if (elapsedDays < 1) {
        return `${elapsedHours}h ${String(elapsedMinutes % 60).padStart(2, '0')}m`
    }

    return `${elapsedDays}d ${elapsedHours % 24}h`
}
