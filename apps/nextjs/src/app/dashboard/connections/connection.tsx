"use client"

import { api } from "@nxt/backend/api"
import { useQuery } from "@nxt/backend/react"

export function Connections(props: { clerkId: string }) {
	const data = useQuery(api.platformLinks.getPlatformLinks, {
		ownerId: props.clerkId,
	})

	if (!data) return null

	return <pre>{JSON.stringify(data, null, 2)}</pre>
}
