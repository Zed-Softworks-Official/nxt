"use client"

import { api } from "@nxt/backend/api"
import { useMutation, useQuery } from "@nxt/backend/react"
import { formatReference } from "@nxt/backend/reference"

import { BellRing, ArrowUp, Undo2 } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card"
import {
	Item,
	ItemContent,
	ItemGroup,
	ItemTitle,
	ItemActions,
} from "~/components/ui/item"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	EmptyDescription,
} from "~/components/ui/empty"
import { cn } from "~/lib/utils"
import { useMemo } from "react"

export function Pinged() {
	const data = useQuery(api.queue.view, {})
	const play = useMutation(api.queue.play)
	const returnToQueue = useMutation(api.queue.returnToQueue)

	if (!data) return null

	const notified = data.pinged

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<BellRing className="size-5 text-chart-2" />
					<CardTitle>Pinged</CardTitle>
					{notified.length > 0 && (
						<span className="ml-auto rounded-full border border-chart-2/30 bg-chart-2/10 px-2 py-0.5 text-xs font-semibold text-chart-2">
							{notified.length}
						</span>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{notified.length === 0 ? (
					<Empty className="border py-8">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<BellRing className="size-5 text-muted-foreground" />
							</EmptyMedia>
							<EmptyTitle className="text-base">No one pinged</EmptyTitle>
							<EmptyDescription>
								Use Quick Ping to call players from the queue.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ItemGroup>
						{notified.map((participant) => (
							<Item
								key={participant.reference}
								variant="outline"
								className="group border-border/60 bg-card/50 shadow-xs transition-all hover:border-primary/35 hover:bg-accent/30"
							>
								<ItemContent className="gap-2">
									<div className="flex items-center justify-between gap-3">
										<div className="flex min-w-0 items-center gap-3">
											<div className="flex size-2 shrink-0 animate-pulse rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
											<ReferenceBadge reference={participant.reference} />
											<ItemTitle className="text-sm font-semibold">
												{participant.username}
											</ItemTitle>
										</div>
										<PlatformBadge platform={participant.platform} />
									</div>
								</ItemContent>
								<ItemActions className="shrink-0">
									<Button
										size="sm"
										variant="outline"
										className="h-7 gap-1.5 border-red-500/40 bg-red-500/10 px-2 text-xs text-red-400 hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-300"
										onClick={() =>
											returnToQueue({ reference: participant.reference })
										}
									>
										<Undo2 className="size-3" />
										Back
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="h-7 gap-1.5 border-chart-2/40 bg-chart-2/10 px-2 text-xs text-chart-2 hover:border-chart-2/60 hover:bg-chart-2/20"
										onClick={() =>
											play({ reference: participant.reference })
										}
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

function ReferenceBadge(props: { reference: number }) {
	return (
		<span className="shrink-0 rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
			{formatReference(props.reference)}
		</span>
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
