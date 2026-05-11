import { SidebarProvider, SidebarInset } from "~/components/ui/sidebar"
import AppSidebar from "~/components/sidebar/app-sidebar"

export default function DashboardLayout(props: { children: React.ReactNode }) {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<div className="flex flex-1 flex-col">{props.children}</div>
			</SidebarInset>
		</SidebarProvider>
	)
}
