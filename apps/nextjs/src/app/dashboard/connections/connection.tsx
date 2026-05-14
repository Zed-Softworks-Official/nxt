"use client"

import { api } from "@nxt/backend/api"
import { useQuery } from "@nxt/backend/react"

import Link from "next/link"
import { useMemo } from "react"

import { Button } from "~/components/ui/button"
import {
	Item,
	ItemGroup,
	ItemTitle,
	ItemDescription,
	ItemMedia,
	ItemContent,
	ItemActions,
} from "~/components/ui/item"

import { env } from "~/env"

export function Connections(props: { clerkId: string }) {
	const platforms = useQuery(api.platformLinks.getPlatformLinks, {
		ownerId: props.clerkId,
	})

	if (!platforms) return <>Loading...</>

	if (platforms.length === 0) {
		return <NoConnections clerkId={props.clerkId} />
	}

	return (
		<ItemGroup>
			{platforms.map((platform) => (
				<Item key={platform.platformId}>
					<ItemTitle>{platform.platformName}</ItemTitle>
				</Item>
			))}
		</ItemGroup>
	)
}

function NoConnections(props: { clerkId: string }) {
	return (
		<ItemGroup>
			<Item>
				<ItemMedia>D</ItemMedia>
				<ItemContent>
					<ItemTitle>Discord</ItemTitle>
					<ItemDescription>
						Connect your Discord account to use the bot.
					</ItemDescription>
				</ItemContent>
				<ItemActions>
					<DiscordConnection clerkId={props.clerkId} />
				</ItemActions>
			</Item>
		</ItemGroup>
	)
}

function DiscordConnection(props: { clerkId: string }) {
	const communityId = useQuery(api.communities.getCommunity, {
		ownerId: props.clerkId,
	})

	const discordUrl = useMemo(() => {
		if (!communityId) return null

		const inviteUrl = new URL("https://discord.com/oauth2/authorize")
		inviteUrl.searchParams.set("client_id", env.NEXT_PUBLIC_DISCORD_CLIENT_ID)
		inviteUrl.searchParams.set("permissions", "2048")
		inviteUrl.searchParams.set("response_type", "code")
		inviteUrl.searchParams.set(
			"redirect_uri",
			env.NEXT_PUBLIC_DISCORD_REDIRECT_URI
		)
		inviteUrl.searchParams.set("scope", "bot")
		inviteUrl.searchParams.set("state", communityId._id)

		return inviteUrl
	}, [communityId])

	if (!discordUrl) return null

	return (
		<Button asChild>
			<Link href={discordUrl.toString()} target="_blank">
				Connect
			</Link>
		</Button>
	)
}
