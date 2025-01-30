export default function DashboardLayout({ children }) {
  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1">{children}</main>
    </div>
  )
}
