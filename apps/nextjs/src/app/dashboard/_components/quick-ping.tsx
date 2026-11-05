'use client'

import { api } from '@nxt/backend/api'
import { useQuery } from '@nxt/backend/react'

import { BellRing, Pause, Play } from 'lucide-react'

import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'

import { useQueueActions } from '../_lib/queue-actions'

export function QuickPing() {
    const data = useQuery(api.queue.view, {})
    const { ping, open, pause } = useQueueActions()

    if (!data) return <QuickPingSkeleton />

    const waitingCount = data.waiting.length
    const queueState = data.state

    return (
        <Card>
            <QuickPingHeader />
            <CardContent className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                        {Array.from({ length: 4 }).map((_, i) => {
                            const amount = i + 1
                            const isDisabled = amount > waitingCount
                            return (
                                <PingButton
                                    key={amount}
                                    amount={amount}
                                    disabled={isDisabled}
                                    onClick={() => ping(amount)}
                                />
                            )
                        })}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                        {waitingCount === 0
                            ? 'No one waiting in queue'
                            : waitingCount === 1
                              ? '1 waiting in queue'
                              : `${waitingCount} waiting in queue`}
                    </span>
                </div>
                <PauseButton
                    queueState={queueState}
                    onClick={() => (queueState === 'open' ? pause() : open())}
                />
            </CardContent>
        </Card>
    )
}

function QuickPingHeader() {
    return (
        <CardHeader>
            <div className="flex items-center gap-2">
                <BellRing className="size-5 text-chart-2" />
                <CardTitle>Quick Ping</CardTitle>
            </div>
        </CardHeader>
    )
}

export function QuickPingSkeleton() {
    return (
        <Card aria-busy="true">
            <QuickPingHeader />
            <CardContent className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                            <Skeleton key={i} className="size-14" />
                        ))}
                    </div>
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-12 w-44" />
            </CardContent>
        </Card>
    )
}

function PingButton(props: {
    amount: number
    disabled?: boolean
    onClick?: () => void
}) {
    return (
        <Button
            className="aspect-square border-primary! bg-chart-2/20! p-5 py-7 disabled:cursor-not-allowed disabled:opacity-35"
            variant="outline"
            disabled={props.disabled}
            onClick={props.onClick}
        >
            <span className="text-2xl font-medium text-chart-2">
                {props.amount}
            </span>
        </Button>
    )
}

function PauseButton(props: {
    queueState: 'open' | 'paused'
    onClick?: () => void
}) {
    const isPaused = props.queueState === 'paused'
    return (
        <Button
            className="p-6"
            size="lg"
            variant="outline"
            onClick={props.onClick}
        >
            {isPaused ? (
                <Play className="size-5" />
            ) : (
                <Pause className="size-5" />
            )}
            <span className="text-md font-bold uppercase">
                {isPaused ? 'Resume Queue' : 'Pause Queue'}
            </span>
        </Button>
    )
}
