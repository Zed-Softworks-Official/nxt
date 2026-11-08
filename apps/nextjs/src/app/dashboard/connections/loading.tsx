import { ConnectionsSkeleton } from './connection'
import { PairedDecksSkeleton } from './paired-decks'

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
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold uppercase">Paired decks</h2>
                <span className="text-sm text-muted-foreground">
                    Stream Decks that can run your Queue. Revoke one to stop it
                    right away.
                </span>
            </div>
            <PairedDecksSkeleton />
        </div>
    )
}
