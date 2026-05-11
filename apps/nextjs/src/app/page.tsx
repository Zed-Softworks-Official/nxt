import Link from "next/link"
import { Button } from "~/components/ui/button"

export default function HomePage() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen py-2">
			<Button asChild>
				<Link href="/u/login">Login</Link>
			</Button>
		</div>
	)
}
