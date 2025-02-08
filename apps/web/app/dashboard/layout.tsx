import { SidebarTrigger } from "../../components/ui/sidebar";

export default function DashboardLayout({ children }) {
	return (
		<div className="flex flex-col h-screen">
			<header className="w-full flex justify-between items-center bg-white shadow-sm p-4">
				<p> Hominem </p>
				<SidebarTrigger />
			</header>
			<main className="flex-1">{children}</main>
		</div>
	);
}
