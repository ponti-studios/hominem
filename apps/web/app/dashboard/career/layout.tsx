export default function Layout({ children }) {
	return (
		<div className="flex flex-col">
			<div className="container mx-auto">{children}</div>
		</div>
	);
}
