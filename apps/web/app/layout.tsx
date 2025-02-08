import Providers from "@/components/providers";
import { SiteNavigation } from "../components/site-navigation";
import "./globals.css";

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>
				<Providers>
					<div className="bg-background text-foreground min-h-screen min-w-full flex flex-col">
						<SiteNavigation />
						<div className="flex-1 flex flex-col">{children}</div>
					</div>
				</Providers>
			</body>
		</html>
	);
}
