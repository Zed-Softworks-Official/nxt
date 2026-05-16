"use client"

import { api } from "@nxt/backend/api"
import { useMutation, useQuery } from "@nxt/backend/react"

import { BellRing, Pause, Play } from "lucide-react"

import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export function QuickPing(props: { userId: string }) {
	const data = useQuery(api.queue.getParticipants, { ownerId: props.userId })
	const pingParticipants = useMutation(api.queue.pingParticipants)
	const toggleQueueState = useMutation(api.queue.toggleQueueState)

	const waitingCount = data?.waiting.length ?? 0
	const queueState = data?.queueState ?? "open"

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
						{Array.from({ length: 4 }).map((_, i) => {
							const amount = i + 1
							const isDisabled = amount > waitingCount
							return (
								<PingButton
									key={amount}
									amount={amount}
									disabled={isDisabled}
									onClick={() =>
										pingParticipants({
											ownerId: props.userId,
											count: amount,
										})
									}
								/>
							)
						})}
					</div>
					<span className="text-xs font-medium text-muted-foreground">
						{waitingCount === 0
							? "No one waiting in queue"
							: waitingCount === 1
								? "1 waiting in queue"
								: `${waitingCount} waiting in queue`}
					</span>
				</div>
				<PauseButton
					queueState={queueState}
					onClick={() => toggleQueueState({ ownerId: props.userId })}
				/>
			</CardContent>
		</Card>
	)
}

function PingButton(props: {
	amount: number
	disabled?: boolean
	onClick?: () => void
}) {
	return (
		<Button
			className="aspect-square border-primary! bg-chart-2/20! p-5 py-7 disabled:cursor-not-allowed disabled:opacity-35"
			variant="outline"
			disabled={props.disabled}
			onClick={props.onClick}
		>
			<span className="text-2xl font-medium text-chart-2">{props.amount}</span>
		</Button>
	)
}

function PauseButton(props: {
	queueState: "open" | "paused"
	onClick?: () => void
}) {
	const isPaused = props.queueState === "paused"
	return (
		<Button className="p-6" size="lg" variant="outline" onClick={props.onClick}>
			{isPaused ? <Play className="size-5" /> : <Pause className="size-5" />}
			<span className="text-md font-bold uppercase">
				{isPaused ? "Resume Queue" : "Pause Queue"}
			</span>
		</Button>
	)
}
