"use client"

import { api } from "@nxt/backend/api"
import { useQuery } from "@nxt/backend/react"

import { useEffect, useMemo, useState } from "react"
import { Users, Timer } from "lucide-react"

import { cn } from "~/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card"
import { Item, ItemContent, ItemGroup, ItemTitle } from "~/components/ui/item"
import { Badge } from "~/components/ui/badge"

export function Queue(props: { userId: string }) {
	const [now, setNow] = useState<number | null>(null)

	useEffect(() => {
		setNow(Date.now())
		const intervalId = window.setInterval(() => {
			setNow(Date.now())
		}, 30_000)

		return () => window.clearInterval(intervalId)
	}, [])

	const participants = useQuery(api.queue.getParticipants, {
		ownerId: props.userId,
	})

	if (!participants) return null

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Users className="size-5 text-chart-2" />
					<CardTitle>Queue</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<ItemGroup>
					{participants.map((participant, i) => (
						<Item
							key={participant.platformUserId}
							variant="outline"
							className="group border-border/60 bg-card/50 shadow-xs transition-all hover:border-primary/35 hover:bg-accent/30"
						>
							<ItemContent className="gap-2">
								<div className="flex items-start justify-between gap-3">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-chart-2/30 bg-chart-2/10 text-xs font-semibold text-chart-2">
											{i + 1}
										</div>
										<ItemTitle className="text-sm font-semibold">
											{participant.username}
										</ItemTitle>
									</div>
									<PlatformBadge platform={participant.platform} />
								</div>
								<div className="ml-10 flex items-center gap-2 text-muted-foreground">
									<div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-1 text-xs">
										<Timer className="size-3.5" />
										{formatElapsedTime(participant._creationTime, now)}
									</div>
								</div>
							</ItemContent>
						</Item>
					))}
				</ItemGroup>
			</CardContent>
		</Card>
	)
}

function PlatformBadge(props: { platform: "discord" | "twitch" | "youtube" }) {
	const badgeText = useMemo(() => {
		switch (props.platform) {
			case "discord":
				return "Discord"
			case "twitch":
				return "Twitch"
			case "youtube":
				return "YouTube"
			default:
				return "Unknown"
		}
	}, [props.platform])

	return (
		<Badge
			className={cn(
				"rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide uppercase",
				{
					"border-[#5864f0]/60 bg-[#5864f0]/15 text-[#5864f0]":
					props.platform === "discord",
					"border-[#9146ff]/60 bg-[#9146ff]/15 text-[#9146ff]":
						props.platform === "twitch",
					"border-[#ff0000]/60 bg-[#ff0000]/15 text-[#ff0000]":
						props.platform === "youtube",
				}
			)}
		>
			{badgeText}
		</Badge>
	)
}

function formatElapsedTime(joinedAtEpoch: number, now: number | null) {
	if (now === null) {
		return "..."
	}

	const elapsedMs = Math.max(0, now - joinedAtEpoch)
	const elapsedMinutes = Math.floor(elapsedMs / 60_000)
	const elapsedHours = Math.floor(elapsedMinutes / 60)
	const elapsedDays = Math.floor(elapsedHours / 24)

	if (elapsedMinutes < 1) {
		return "<1m"
	}

	if (elapsedHours < 1) {
		return `${elapsedMinutes}m`
	}

	if (elapsedDays < 1) {
		return `${elapsedHours}h ${String(elapsedMinutes % 60).padStart(2, "0")}m`
	}

	return `${elapsedDays}d ${elapsedHours % 24}h`
}
