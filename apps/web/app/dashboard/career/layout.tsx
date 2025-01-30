export default function Layout({ children }) {
  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div>
              <h2 className="text-2xl font-bold">Career</h2>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto px-4">{children}</div>
      </main>
    </div>
  )
}
