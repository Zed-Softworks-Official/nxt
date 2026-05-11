import { currentUser } from "@clerk/nextjs/server"
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
					<SidebarMenuButton asChild>
						<SidebarMenuItem>
							<Link className="font-bold" href="/dashboard">
								nxtbot
							</Link>
						</SidebarMenuItem>
					</SidebarMenuButton>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain />
			</SidebarContent>
			<SidebarFooter>
				<NavUser
					user={{
						username: user.username,
						imageUrl: user.imageUrl,
					}}
				/>
			</SidebarFooter>
		</Sidebar>
	)
}
