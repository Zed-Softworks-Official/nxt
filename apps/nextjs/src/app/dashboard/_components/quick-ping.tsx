"use client"

import { BellRing, Pause } from "lucide-react"

import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export function QuickPing(props: { userId: string }) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<BellRing className="size-5 text-chart-2" />
					<CardTitle>Quick Ping</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="flex flex-col items-center gap-4">
				<div className="flex flex-col items-center gap-2">
					<div className="flex items-center gap-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<PingButton
								key={crypto.randomUUID()}
								userId={props.userId}
								amount={i + 1}
							/>
						))}
					</div>
					<span className="text-xs font-medium text-muted-foreground">
						12 waiting in queue
					</span>
				</div>
				<PauseButton userId={props.userId} />
			</CardContent>
		</Card>
	)
}

function PingButton(props: {
	userId: string
	amount: number
	disabled?: boolean
}) {
	return (
		<Button
			className="aspect-square border-primary! bg-chart-2/20! p-5 py-7"
			variant="outline"
		>
			<span className="text-2xl font-medium text-chart-2">{props.amount}</span>
		</Button>
	)
}

function PauseButton(props: { userId: string }) {
	return (
		<Button className="p-6" size="lg" variant="outline">
			<Pause className="size-5" />
			<span className="text-md font-bold uppercase">Pause Queue</span>
		</Button>
	)
}
