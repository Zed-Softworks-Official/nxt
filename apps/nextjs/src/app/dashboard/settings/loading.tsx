import { SavedPingNoteSkeleton } from './saved-ping-note'

export default function SettingsLoading() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold uppercase">Settings</h2>
                <span className="text-sm text-muted-foreground">
                    Manage your Community here.
                </span>
            </div>
            <SavedPingNoteSkeleton />
        </div>
    )
}
