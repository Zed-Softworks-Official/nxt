import { currentUser } from "@clerk/nextjs/server"

import Link from "next/link"
import { redirect } from "next/navigation"

import { Button } from "~/components/ui/button"

export default async function HomePage() {
	const user = await currentUser()
	if (user) {
		return redirect("/dashboard")
	}

	return (
		<div className="flex flex-col items-center justify-center min-h-screen py-2">
			<Button asChild>
				<Link href="/u/login">Login</Link>
			</Button>
		</div>
	)
}
