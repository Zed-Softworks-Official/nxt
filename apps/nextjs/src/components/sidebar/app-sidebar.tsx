import Link from "next/link"
import {
	Sidebar,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
} from "~/components/ui/sidebar"

export default function AppSidebar() {
	return (
		<Sidebar variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem asChild>
						<Link href="/dashboard">nxtbot</Link>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
		</Sidebar>
	)
}
