import { currentUser } from "@clerk/nextjs/server"
import { trustedConvexClient } from "@nxt/backend"
import { api, internal } from "@nxt/backend/api"
import { redirect } from "next/navigation"

import { env } from "~/env"

import { ActivityLog } from "./_components/activity-log"
import { CurrentlyPlaying } from "./_components/currently-playing"
import { Pinged } from "./_components/pinged"
import { Queue } from "./_components/queue"
import { QuickPing } from "./_components/quick-ping"

export default async function DashboardPage() {
	const user = await currentUser()
	if (!user) return redirect("/u/login")

	const convex = trustedConvexClient(
		env.NEXT_PUBLIC_CONVEX_URL,
		env.CONVEX_DEPLOY_KEY,
	)
	const community = await convex.query(api.communities.getCommunity, {
		ownerId: user.id,
	})
	if (community) {
		await convex.mutation(internal.queue.ensureQueueForCommunity, {
			communityId: community._id,
		})
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
			<div className="col-span-1 md:col-span-2 flex flex-col gap-4">
				<QuickPing userId={user.id} />
				<ActivityLog userId={user.id} />
			</div>
			<div className="col-span-4 flex flex-col gap-4">
				<CurrentlyPlaying userId={user.id} />
				<Pinged userId={user.id} />
				<Queue userId={user.id} />
			</div>
		</div>
	)
}
