import { SignIn } from "@clerk/nextjs"

export default function LoginPage() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen py-2">
			<SignIn />
		</div>
	)
}
