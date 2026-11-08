'use client'

import { api } from '@nxt/backend/api'
import { isAnnouncementFailed } from '@nxt/backend/failedAnnouncement'
import { useQuery } from '@nxt/backend/react'

import { ArrowUp, BellRing, TriangleAlert, Undo2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '~/components/ui/empty'
import {
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemTitle,
} from '~/components/ui/item'
import { useNow } from '../_lib/failed-announcement'
import { useQueueActions } from '../_lib/queue-actions'
import { PlatformBadge, ReferenceBadge } from './participant-badges'
import { ParticipantRowsSkeleton } from './skeletons'

export function Pinged() {
    const data = useQuery(api.queue.view, {})
    const { play, returnToQueue } = useQueueActions()
    const now = useNow()

    if (!data) return <PingedSkeleton />

    const pinged = data.pinged

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <BellRing className="size-5 text-chart-2" />
                    <CardTitle>Pinged</CardTitle>
                    {pinged.length > 0 && (
                        <span className="ml-auto rounded-full border border-chart-2/30 bg-chart-2/10 px-2 py-0.5 text-xs font-semibold text-chart-2">
                            {pinged.length}
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {pinged.length === 0 ? (
                    <Empty className="border py-8">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <BellRing className="size-5 text-muted-foreground" />
                            </EmptyMedia>
                            <EmptyTitle className="text-base">
                                No one pinged
                            </EmptyTitle>
                            <EmptyDescription>
                                Use Quick Ping to call players from the queue.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ItemGroup>
                        {pinged.map((participant) => (
                            <Item
                                key={participant.reference}
                                variant="outline"
                                className="group border-border/60 bg-card/50 shadow-xs transition-all hover:border-primary/35 hover:bg-accent/30"
                            >
                                <ItemContent className="gap-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex size-2 shrink-0 animate-pulse rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
                                            <ReferenceBadge
                                                reference={
                                                    participant.reference
                                                }
                                            />
                                            <ItemTitle className="text-sm font-semibold">
                                                {participant.username}
                                            </ItemTitle>
                                        </div>
                                        <PlatformBadge
                                            platform={participant.platform}
                                        />
                                    </div>
                                    {isAnnouncementFailed(
                                        participant.announcementPendingSince,
                                        now
                                    ) && (
                                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                                            <TriangleAlert className="size-3 shrink-0" />
                                            Couldn't reach them yet. Nxt is
                                            still trying.
                                        </span>
                                    )}
                                </ItemContent>
                                <ItemActions className="shrink-0">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 gap-1.5 border-red-500/40 bg-red-500/10 px-2 text-xs text-red-400 hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-300"
                                        onClick={() =>
                                            returnToQueue(participant)
                                        }
                                    >
                                        <Undo2 className="size-3" />
                                        Back
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 gap-1.5 border-chart-2/40 bg-chart-2/10 px-2 text-xs text-chart-2 hover:border-chart-2/60 hover:bg-chart-2/20"
                                        onClick={() => play(participant)}
                                    >
                                        <ArrowUp className="size-3" />
                                        Playing
                                    </Button>
                                </ItemActions>
                            </Item>
                        ))}
                    </ItemGroup>
                )}
            </CardContent>
        </Card>
    )
}

export function PingedSkeleton() {
    return (
        <Card aria-busy="true">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <BellRing className="size-5 text-chart-2" />
                    <CardTitle>Pinged</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <ParticipantRowsSkeleton rows={1} actions={2} />
            </CardContent>
        </Card>
    )
}
