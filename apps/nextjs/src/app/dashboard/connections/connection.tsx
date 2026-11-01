"use client"

import { api } from "@nxt/backend/api"
import { useMutation, useQuery } from "@nxt/backend/react"

import { useState } from "react"

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
		return <NoConnections />
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

function NoConnections() {
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
					<DiscordConnection />
				</ItemActions>
			</Item>
		</ItemGroup>
	)
}

function DiscordConnection() {
	const mintLinkState = useMutation(api.linkStates.mintLinkState)
	const [pending, setPending] = useState(false)

	async function connect() {
		// Open the tab synchronously so the popup blocker allows it, then point
		// it at Discord once the owner-bound state is minted.
		const tab = window.open("", "_blank")
		setPending(true)
		try {
			const state = await mintLinkState({ platform: "discord" })

			const inviteUrl = new URL("https://discord.com/oauth2/authorize")
			inviteUrl.searchParams.set(
				"client_id",
				env.NEXT_PUBLIC_DISCORD_CLIENT_ID
			)
			inviteUrl.searchParams.set("permissions", "2048")
			inviteUrl.searchParams.set("response_type", "code")
			inviteUrl.searchParams.set(
				"redirect_uri",
				env.NEXT_PUBLIC_DISCORD_REDIRECT_URI
			)
			inviteUrl.searchParams.set("scope", "bot")
			inviteUrl.searchParams.set("state", state)

			if (tab) tab.location.href = inviteUrl.toString()
			else window.location.href = inviteUrl.toString()
		} catch (error) {
			tab?.close()
			throw error
		} finally {
			setPending(false)
		}
	}

	return (
		<Button disabled={pending} onClick={() => void connect()}>
			Connect
		</Button>
	)
}
