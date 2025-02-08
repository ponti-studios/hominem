"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient } from "@/lib/get-query-client";
import type * as React from "react";
import { SidebarProvider } from "./ui/sidebar";

export default function Providers({ children }: { children: React.ReactNode }) {
	const queryClient = getQueryClient();

	return (
		<ClerkProvider>
			<QueryClientProvider client={queryClient}>
				<SidebarProvider>{children}</SidebarProvider>
				<ReactQueryDevtools />
			</QueryClientProvider>
		</ClerkProvider>
	);
}
