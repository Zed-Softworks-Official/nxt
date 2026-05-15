"use client"

import { api } from "@nxt/backend/api"
import { useQuery } from "@nxt/backend/react"

import { useMemo } from "react"
import { Users, Timer } from "lucide-react"

import { cn } from "~/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card"
import { Item, ItemContent, ItemGroup, ItemTitle } from "~/components/ui/item"
import { Badge } from "~/components/ui/badge"

export function Queue(props: { userId: string }) {
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
						<Item key={participant.platformUserId}>
							<ItemContent>
								<div className="flex items-center gap-2">
									<span className="text-xs font-medium text-muted-foreground">
										{i + 1}
									</span>

									<ItemTitle>{participant.username}</ItemTitle>
								</div>
								<div className="flex items-center gap-2">
									<PlatformBadge platform={participant.platform} />
									<div className="text-muted-foreground text-xs">
										<Timer className="size-4" />
										{convertEPOCHtoTime(participant._creationTime)}
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
			className={cn("rounded-sm px-4 py-3 uppercase", {
				"bg-[#5864f0]/70 border-2 border-[#5864f0]":
					props.platform === "discord",
				"bg-[#00acee]": props.platform === "twitch",
				"bg-[#ff0000]": props.platform === "youtube",
			})}
		>
			{badgeText}
		</Badge>
	)
}

function convertEPOCHtoTime(epoch: number) {
	const date = new Date(epoch)
	const hr = date.getUTCHours()
	const min = "0" + date.getUTCMinutes()

	if (hr === 0) {
		return `${min.substring(-2)}m`
	}

	return `${hr}h ${min.substring(-2)}m`
}
