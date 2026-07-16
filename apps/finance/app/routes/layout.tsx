import { Spinner } from '@ponti-studios/ui/feedback';
import { Suspense } from 'react';
import { Outlet } from 'react-router';

import Header from '../components/header';
import { Toaster } from '../lib/toast';

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      {/* Single page frame: all routes inherit this width + padding. Do not re-add container shells in routes. */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center py-16">
              <Spinner size="md" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Toaster />
    </div>
  );
}
