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

	return (
		<Sidebar variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<Link className="font-bold text-xl flex items-center" href="/dashboard">
                                <SkipForward className="size-4" />
								nxt
								<span className="text-chart-2 -ml-1.5">bot</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain />
			</SidebarContent>
			<SidebarFooter>
				<NavUser
					user={{
						username: user?.username ?? "",
						imageUrl: user?.imageUrl ?? "",
					}}
				/>
			</SidebarFooter>
		</Sidebar>
	)
}
