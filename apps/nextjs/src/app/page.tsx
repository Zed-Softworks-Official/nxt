import { currentUser } from '@clerk/nextjs/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '~/components/ui/button'

export default async function HomePage() {
    const user = await currentUser()

    if (user) redirect('/dashboard')

    return (
        <main className="flex h-dvh flex-col items-center justify-center gap-6 overflow-hidden px-6 text-center">
            <h1 className="font-heading font-semibold text-7xl tracking-tighter sm:text-8xl">
                nxt
            </h1>
            <Button asChild size="lg">
                <Link href="/u/login">Sign in</Link>
            </Button>
        </main>
    )
}
