import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import AppSidebar from "~/components/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"

export default async function DashboardLayout(props: {
	children: React.ReactNode
}) {
	const authData = await auth()
	if (!authData.userId) {
		return redirect("/u/login")
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<div className="flex flex-1 flex-col p-4">{props.children}</div>
			</SidebarInset>
		</SidebarProvider>
	)
}
