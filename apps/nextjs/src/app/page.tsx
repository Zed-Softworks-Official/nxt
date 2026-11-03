import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
    const user = await currentUser()

    redirect(user ? '/dashboard' : '/u/login')
}
