"use client"

import { useAuth } from "@clerk/nextjs"
import { ConvexProviderWithClerk, ConvexReactClient } from "@nxt/backend/react"

import { env } from "~/env"

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL)

export function ConvexProvider(props: { children: React.ReactNode }) {
	return (
		<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
			{props.children}
		</ConvexProviderWithClerk>
	)
}
