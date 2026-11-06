import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { SavedPingNote } from './saved-ping-note'

export default async function SettingsPage() {
    const user = await currentUser()
    if (!user) return redirect('/u/login')

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold uppercase">Settings</h2>
                <span className="text-sm text-muted-foreground">
                    Manage your Community here.
                </span>
            </div>
            <SavedPingNote />
        </div>
    )
}
