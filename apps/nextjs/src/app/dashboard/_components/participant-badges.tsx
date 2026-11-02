import { platformLabel, type Platform } from "@nxt/backend/participant"
import { formatReference } from "@nxt/backend/reference"

import { cn } from "~/lib/utils"
import { Badge } from "~/components/ui/badge"

// Badges shown beside a Participant on the dashboard's Queue, Pinged and
// Playing lists.

export function ReferenceBadge(props: { reference: number }) {
	return (
		<span className="shrink-0 rounded-md border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
			{formatReference(props.reference)}
		</span>
	)
}

export function PlatformBadge(props: { platform: Platform }) {
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
			{platformLabel(props.platform)}
		</Badge>
	)
}
