import { ActivityLogSkeleton } from './_components/activity-log'
import { CurrentlyPlayingSkeleton } from './_components/currently-playing'
import { PingedSkeleton } from './_components/pinged'
import { QueueSkeleton } from './_components/queue'
import { QuickPingSkeleton } from './_components/quick-ping'

// Shown while the dashboard page resolves the Community and its Queue on the
// server. Mirrors the page grid in ./page.tsx.
export default function DashboardLoading() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="col-span-1 md:col-span-2 flex flex-col gap-4">
                <QuickPingSkeleton />
                <ActivityLogSkeleton />
            </div>
            <div className="col-span-4 flex flex-col gap-4">
                <CurrentlyPlayingSkeleton />
                <PingedSkeleton />
                <QueueSkeleton />
            </div>
        </div>
    )
}
