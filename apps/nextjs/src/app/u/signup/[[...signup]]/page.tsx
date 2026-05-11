import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen py-2">
			<SignUp
				routing="path"
				path="/u/signup"
				signInUrl="/u/login"
				fallbackRedirectUrl="/dashboard"
			/>
		</div>
	)
}
