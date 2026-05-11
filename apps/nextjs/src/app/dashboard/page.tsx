import { BellRing, Pause } from "lucide-react"

import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

export default function DashboardPage() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
			<div className="col-span-1 md:col-span-2 flex flex-col gap-2">
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
										className="aspect-square border-primary! bg-chart-2/20!"
										variant="outline"
									>
										<span className="text-xl font-medium">{i + 1}</span>
									</Button>
								))}
							</div>
							<span className="text-xs font-medium text-muted-foreground">
								12 waiting in queue
							</span>
						</div>
						<Button size="lg">
							<Pause className="size-5" />
							<span className="text-lg font-bold uppercase">Pause Queue</span>
						</Button>
					</CardContent>
				</Card>
			</div>
			<div className="col-span-4">Rest</div>
		</div>
	)
}
