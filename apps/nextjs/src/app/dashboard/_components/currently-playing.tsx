'use client'

import { api } from '@nxt/backend/api'
import { useQuery } from '@nxt/backend/react'

import { CheckCheck, Radio } from 'lucide-react'
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
import { useQueueActions } from '../_lib/queue-actions'
import { PlatformBadge, ReferenceBadge } from './participant-badges'
import { ParticipantContextMenu } from './participant-context-menu'
import { ParticipantRowsSkeleton } from './skeletons'

export function CurrentlyPlaying() {
    const data = useQuery(api.queue.view, {})
    const { done } = useQueueActions()

    if (!data) return <CurrentlyPlayingSkeleton />

    const { playing } = data

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Radio className="size-5 text-chart-2" />
                    <CardTitle>Currently Playing</CardTitle>
                    {playing.length > 0 && (
                        <span className="ml-auto rounded-full border border-chart-2/30 bg-chart-2/10 px-2 py-0.5 text-xs font-semibold text-chart-2">
                            {playing.length}
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {playing.length === 0 ? (
                    <Empty className="border py-8">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Radio className="size-5 text-muted-foreground" />
                            </EmptyMedia>
                            <EmptyTitle className="text-base">
                                No one playing
                            </EmptyTitle>
                            <EmptyDescription>
                                Move pinged players up to start a session.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ItemGroup>
                        {playing.map((participant) => (
                            <ParticipantContextMenu
                                key={participant.reference}
                                participant={participant}
                                state={{ kind: 'playing' }}
                            >
                                <Item
                                    variant="outline"
                                    className="border-chart-2/30 bg-chart-2/5 shadow-xs transition-all hover:border-chart-2/50 hover:bg-chart-2/10"
                                >
                                    <ItemContent className="gap-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex size-2 shrink-0 rounded-full bg-chart-2 ring-2 ring-chart-2/30" />
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
                                    </ItemContent>
                                    <ItemActions className="shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 gap-1.5 border-emerald-500/40 bg-emerald-500/10 px-2 text-xs text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/20 hover:text-emerald-300"
                                            onClick={() => done(participant)}
                                        >
                                            <CheckCheck className="size-3" />
                                            Done
                                        </Button>
                                    </ItemActions>
                                </Item>
                            </ParticipantContextMenu>
                        ))}
                    </ItemGroup>
                )}
            </CardContent>
        </Card>
    )
}

export function CurrentlyPlayingSkeleton() {
    return (
        <Card aria-busy="true">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Radio className="size-5 text-chart-2" />
                    <CardTitle>Currently Playing</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <ParticipantRowsSkeleton rows={1} actions={1} />
            </CardContent>
        </Card>
    )
}
