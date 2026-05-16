"use client"

import { api } from "@nxt/backend/api"
import { useMutation, useQuery } from "@nxt/backend/react"

import { Radio, CheckCheck } from "lucide-react"
import { useMemo } from "react"

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
import type { Id } from "@nxt/backend/dataModel"

export function CurrentlyPlaying(props: { userId: string }) {
	const data = useQuery(api.queue.getParticipants, { ownerId: props.userId })
	const markDone = useMutation(api.queue.markDone)

	if (!data) return null

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
							<EmptyTitle className="text-base">No one playing</EmptyTitle>
							<EmptyDescription>
								Move pinged players up to start a session.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<ItemGroup>
						{playing.map((participant) => (
							<Item
								key={participant._id}
								variant="outline"
								className="border-chart-2/30 bg-chart-2/5 shadow-xs transition-all hover:border-chart-2/50 hover:bg-chart-2/10"
							>
								<ItemContent className="gap-2">
									<div className="flex items-center justify-between gap-3">
										<div className="flex min-w-0 items-center gap-3">
											<div className="flex size-2 shrink-0 rounded-full bg-chart-2 ring-2 ring-chart-2/30" />
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
										className="h-7 gap-1.5 border-emerald-500/40 bg-emerald-500/10 px-2 text-xs text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/20 hover:text-emerald-300"
										onClick={() =>
											markDone({
												participantId: participant._id as Id<"participants">,
											})
										}
									>
										<CheckCheck className="size-3" />
										Done
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
