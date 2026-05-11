import { BellRing, Pause, Radio, Users } from "lucide-react"

import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export default function DashboardPage() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
			<div className="col-span-1 md:col-span-2 flex flex-col gap-4">
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
									<Button
										key={`button-${i}`}
										className="aspect-square border-primary! bg-chart-2/20! p-5 py-7"
										variant="outline"
									>
										<span className="text-2xl font-medium text-chart-2">
											{i + 1}
										</span>
									</Button>
								))}
							</div>
							<span className="text-xs font-medium text-muted-foreground">
								12 waiting in queue
							</span>
						</div>
						<Button className="p-6" size="lg" variant="outline">
							<Pause className="size-5" />
							<span className="text-md font-bold uppercase">Pause Queue</span>
						</Button>
					</CardContent>
				</Card>
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
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Users className="size-5 text-chart-2" />
							<CardTitle>Queue</CardTitle>
						</div>
					</CardHeader>
				</Card>
			</div>
		</div>
	)
}
