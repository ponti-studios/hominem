"use client";

import { SignInButton, SignOutButton, useUser } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import Link from "next/link";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
} from "@/components/ui/sidebar";

export function SiteNavigation() {
	const { user } = useUser();

	return (
		<Sidebar>
			<SidebarHeader>
				{user ? (
					<div className="flex gap-4 items-center border-input border rounded-md px-3 py-2">
						<Link href="/dashboard/profile" className="text-sm font-medium">
							{user.fullName}
						</Link>
					</div>
				) : (
					<SignInButton />
				)}
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<Link
						href="/dashboard/career/applications"
						className="text-sm font-medium"
					>
						Applications
					</Link>
					<Link href="/dashboard/finance" className="text-sm font-medium">
						Finance
					</Link>
				</SidebarGroup>
				<SidebarGroup />
			</SidebarContent>
			<SidebarFooter>
				<SignOutButton>
					<span className="btn bg-black text-white max-h-fit">Sign Out</span>
				</SignOutButton>
			</SidebarFooter>
		</Sidebar>
	);
}
