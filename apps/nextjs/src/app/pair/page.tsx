import { auth } from '@clerk/nextjs/server'
import { PAIRING_PATH, readPairingLink } from '@nxt/backend/pairingLink'
import { redirect } from 'next/navigation'

import { ApprovePairing } from './approve-pairing'

// The link a Stream Deck plugin shows: `/pair?code=ABCD2345&name=My%20Deck`.
export default async function PairPage(props: {
    searchParams: Promise<{
        code?: string | string[]
        name?: string | string[]
    }>
}) {
    const prefill = readPairingLink(await props.searchParams)

    const { userId } = await auth()
    if (!userId) {
        // Come back to this same link, code and name intact, after signing in.
        const back = new URLSearchParams()
        if (prefill.code) back.set('code', prefill.code)
        if (prefill.name) back.set('name', prefill.name)
        const query = back.size > 0 ? `?${back}` : ''
        return redirect(
            `/u/login?redirect_url=${encodeURIComponent(PAIRING_PATH + query)}`
        )
    }

    return (
        <main className="flex min-h-screen items-center justify-center p-4">
            <ApprovePairing code={prefill.code} name={prefill.name} />
        </main>
    )
}
