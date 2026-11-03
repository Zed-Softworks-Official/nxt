import { ConnectionsSkeleton } from './connection'

export default function ConnectionsLoading() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold uppercase">Bot Connections</h2>
                <span className="text-sm text-muted-foreground">
                    Manage your bot connections here.
                </span>
            </div>
            <ConnectionsSkeleton />
        </div>
    )
}
