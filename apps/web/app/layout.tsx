import './globals.css';

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="py-8 px-4">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-4xl font-bold">Random</h1>
          </div>
        </header>
        <main className="container mx-auto py-16 px-4 flex-1 flex flex-col max-w-4xl">
          {children}
        </main>
        <footer className="py-4 px-4 bg-gray-200 dark:bg-gray-800">
          <div className="container mx-auto text-center">
            &copy; 2023 Ponti Studios. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
