import { currentUser } from "@clerk/nextjs/server"
import { SkipForward } from "lucide-react"
import Link from "next/link"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar"

import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"

export default async function AppSidebar() {
	const user = await currentUser()
	if (!user) return null

	return (
		<Sidebar variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<Link
							className="font-bold text-xl flex items-center"
							href="/dashboard"
						>
							<SidebarMenuButton
								className="data-[slot=sidebar-menu-button]:p-1.5! text-md"
							>
								<SkipForward className="size-4" />
								nxt
								<span className="text-chart-2 -ml-1.5 mt-0.5">bot</span>
							</SidebarMenuButton>
						</Link>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain />
			</SidebarContent>
			<SidebarFooter>
				<NavUser
					user={{
						username: user.username ?? "Username",
						imageUrl: user.imageUrl,
					}}
				/>
			</SidebarFooter>
		</Sidebar>
	)
}
