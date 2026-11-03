import { Item, ItemContent, ItemGroup } from '~/components/ui/item'
import { Skeleton } from '~/components/ui/skeleton'

// Placeholder rows shown while a dashboard card's Convex query is loading.
// They mirror the shape of the real rows so the layout doesn't jump.

export function ParticipantRowsSkeleton(props: {
    rows?: number
    actions?: number
    meta?: boolean
}) {
    const { rows = 3, actions = 0, meta = false } = props

    return (
        <ItemGroup>
            {Array.from({ length: rows }).map((_, i) => (
                <Item
                    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                    key={i}
                    variant="outline"
                    className="border-border/60 bg-card/50"
                >
                    <ItemContent className="gap-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <Skeleton
                                    className={
                                        meta
                                            ? 'size-7 rounded-full'
                                            : 'size-2 rounded-full'
                                    }
                                />
                                <Skeleton className="h-5 w-10" />
                                <Skeleton className="h-4 w-28" />
                            </div>
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        {meta && (
                            <Skeleton className="ml-10 h-6 w-16 rounded-full" />
                        )}
                    </ItemContent>
                    {actions > 0 && (
                        <div className="flex shrink-0 gap-2">
                            {Array.from({ length: actions }).map((_, j) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                                <Skeleton key={j} className="h-7 w-16" />
                            ))}
                        </div>
                    )}
                </Item>
            ))}
        </ItemGroup>
    )
}

export function ActivityRowsSkeleton(props: { rows?: number }) {
    const { rows = 4 } = props

    return (
        <div className="flex flex-col">
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                    key={i}
                    className="flex gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                    <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                        <div className="flex flex-col gap-1.5">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                        <Skeleton className="h-3 w-12" />
                    </div>
                </div>
            ))}
        </div>
    )
}
