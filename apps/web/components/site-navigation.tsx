"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

export function SiteNavigation() {
	const pathname = usePathname();

	return (
		<nav className="w-full px-4 flex border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex py-6 items-center justify-end lg:justify-start">
				<Sheet>
					<SheetTrigger className="lg:hidden">
						<Menu className="h-6 w-6" />
						<span className="sr-only">Toggle menu</span>
					</SheetTrigger>
					<SheetContent>
						<nav className="flex flex-col gap-4">
							<Link href="/" className="text-sm font-medium">
								Home
							</Link>
							<Link
								href="/dashboard/career/applications"
								className="text-sm font-medium"
							>
								Applications
							</Link>
						</nav>
					</SheetContent>
				</Sheet>
				<div className="hidden lg:flex lg:gap-6 items-center">
					<p className="text-2xl font-extrabold">Hiragana</p>
					<DesktopLink href="/">Home</DesktopLink>
					<DesktopLink
						isSelected={pathname.startsWith("/dashboard/career")}
						href="/dashboard/career/applications"
					>
						Career
					</DesktopLink>
					<DesktopLink
						isSelected={pathname.startsWith("/dashboard/finance")}
						href="/dashboard/finance"
					>
						Finance
					</DesktopLink>
					<DesktopLink
						isSelected={pathname.startsWith("/dashboard/activities")}
						href="/dashboard/career/activities"
					>
						Activities
					</DesktopLink>
				</div>
			</div>
		</nav>
	);
}

interface DesktopLinkProps {
	isSelected?: boolean;
	href: string;
	children: React.ReactNode;
}
const DesktopLink = ({ isSelected, href, children }: DesktopLinkProps) => {
	return (
		<Link
			href={href}
			className={cn(
				{
					"text-primary": isSelected,
					"text-foreground": !isSelected,
				},
				"text-sm font-medium transition-colors hover:bg-primary hover:text-background px-2 py-1 rounded",
			)}
		>
			{children}
		</Link>
	);
};
