"use client"

import { api } from "@nxt/backend/api"
import { useQuery } from "@nxt/backend/react"

import { ScrollText, BellRing, Undo2, CheckCheck } from "lucide-react"
import { useState, useEffect } from "react"

import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card"
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	EmptyDescription,
} from "~/components/ui/empty"
import { cn } from "~/lib/utils"

type Event = "pinged" | "returned_to_queue" | "finished"

const EVENT_CONFIG: Record<
	Event,
	{ label: string; icon: React.ElementType; color: string; dot: string }
> = {
	pinged: {
		label: "Pinged",
		icon: BellRing,
		color: "text-amber-400",
		dot: "bg-amber-400",
	},
	returned_to_queue: {
		label: "No response — back to queue",
		icon: Undo2,
		color: "text-red-400",
		dot: "bg-red-400",
	},
	finished: {
		label: "Finished",
		icon: CheckCheck,
		color: "text-emerald-400",
		dot: "bg-emerald-400",
	},
}

function isKnownEvent(value: unknown): value is Event {
	return (
		value === "pinged" || value === "returned_to_queue" || value === "finished"
	)
}

export function ActivityLog(props: { userId: string }) {
	const entries = useQuery(api.queue.getActivityLog, { ownerId: props.userId })

	if (!entries) return null

	const validEntries = entries.filter((e) => isKnownEvent(e.event))

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<ScrollText className="size-5 text-chart-2" />
					<CardTitle>Activity Log</CardTitle>
					{validEntries.length > 0 && (
						<span className="ml-auto rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
							{validEntries.length}
						</span>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{validEntries.length === 0 ? (
					<Empty className="border py-8">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<ScrollText className="size-5 text-muted-foreground" />
							</EmptyMedia>
							<EmptyTitle className="text-base">No activity yet</EmptyTitle>
							<EmptyDescription>
								Pings, no-shows, and finished sessions will appear here.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="flex flex-col">
						{validEntries.map((entry, i) => (
							<LogEntry
								key={entry._id}
								username={(entry as any).username}
								event={(entry as any).event as Event}
								creationTime={entry._creationTime}
								isLast={i === validEntries.length - 1}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	)
}

function LogEntry(props: {
	username: string
	event: Event
	creationTime: number
	isLast: boolean
}) {
	const { username, event, creationTime, isLast } = props
	const config = EVENT_CONFIG[event]
	const Icon = config.icon

	const timeAgo = useTimeAgo(creationTime)

	return (
		<div className="relative flex gap-3 py-2.5 first:pt-0 last:pb-0">
			{/* Timeline line */}
			{!isLast && (
				<div className="absolute top-5 left-[7px] bottom-0 w-px bg-border/50" />
			)}

			{/* Event dot */}
			<div className="relative mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
				<div className={cn("size-2 rounded-full", config.dot)} />
			</div>

			{/* Content */}
			<div className="flex min-w-0 flex-1 items-start justify-between gap-2">
				<div className="flex min-w-0 flex-col gap-0.5">
					<div className="flex items-center gap-1.5">
						<Icon className={cn("size-3 shrink-0", config.color)} />
						<span className={cn("text-xs font-semibold", config.color)}>
							{config.label}
						</span>
					</div>
					<span className="truncate text-sm font-medium text-foreground">
						{username}
					</span>
				</div>
				<span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
					{timeAgo}
				</span>
			</div>
		</div>
	)
}

function computeTimeAgo(timestamp: number): string {
	const ms = Math.max(0, Date.now() - timestamp)
	const minutes = Math.floor(ms / 60_000)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (minutes < 1) return "just now"
	if (hours < 1) return `${minutes}m ago`
	if (days < 1) return `${hours}h ago`
	return `${days}d ago`
}

function useTimeAgo(timestamp: number) {
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
