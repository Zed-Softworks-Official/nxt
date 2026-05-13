import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { Connections } from "./connection"

export default async function ConnectionsPage() {
	const user = await currentUser()
	if (!user) return redirect("/u/login")

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<h2 className="text-xl font-bold uppercase">Bot Connections</h2>
				<span className="text-sm text-muted-foreground">
					Manage your bot connections here.
				</span>
			</div>
			<Connections clerkId={user.id} />
		</div>
	)
}
