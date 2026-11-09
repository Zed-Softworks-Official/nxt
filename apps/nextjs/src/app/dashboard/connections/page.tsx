import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { Connections } from './connection'

export default async function ConnectionsPage(props: {
    searchParams: Promise<{ reason?: string }>
}) {
    const { reason } = await props.searchParams
    const user = await currentUser()
    if (!user) return redirect('/u/login')

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold uppercase">Bot Connections</h2>
                <span className="text-sm text-muted-foreground">
                    Manage your bot connections here.
                </span>
            </div>
            {reason === 'wrong_channel' && (
                <p className="text-sm text-destructive" role="alert">
                    That Twitch account isn't the linked channel. Sign in as the
                    linked channel's broadcaster to reconnect, or unlink it
                    first.
                </p>
            )}
            <Connections />
        </div>
    )
}
