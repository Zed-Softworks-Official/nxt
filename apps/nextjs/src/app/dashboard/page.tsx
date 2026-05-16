import { currentUser } from "@clerk/nextjs/server"

import { Radio } from "lucide-react"
import { redirect } from "next/navigation"

import { Card, CardHeader, CardTitle } from "~/components/ui/card"

import { Queue } from "./_components/queue"
import { QuickPing } from "./_components/quick-ping"

export default async function DashboardPage() {
	const user = await currentUser()
	if (!user) return redirect("/u/login")

	return (
		<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
			<div className="col-span-1 md:col-span-2 flex flex-col gap-4">
				<QuickPing userId={user.id} />
			</div>
			<div className="col-span-4 flex flex-col gap-4">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Radio className="size-5 text-chart-2" />
							<CardTitle>Currently Playing</CardTitle>
						</div>
					</CardHeader>
				</Card>
				<Queue userId={user.id} />
			</div>
		</div>
	)
}
