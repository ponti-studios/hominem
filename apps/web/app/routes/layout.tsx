'use client';

import { useSession } from '@hominem/auth/client';
import { Toaster } from '@hominem/ui';
import { NavLink, Outlet } from 'react-router';

import { WEB_BRAND } from '~/lib/brand';
import { useSignOut } from '~/lib/hooks/use-sign-out';

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-full px-3 py-1.5 text-sm ${isActive ? 'bg-foreground text-background' : 'text-text-secondary'}`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Layout() {
  // Skip rendering client-only content on server
  if (typeof window === 'undefined') {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="py-10 text-sm text-text-secondary">Loading...</div>
        </main>
        <Toaster />
      </div>
    );
  }

  const session = useSession();
  const userId = session.data?.user?.id ?? null;
  const isLoading = session.isPending;
  const signOut = useSignOut();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {userId ? (
        <header className="border-b border-border-subtle bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-tertiary">{WEB_BRAND.appName}</p>
            </div>
            <nav className="flex items-center gap-2">
              <NavItem to="/notes" label="Notes" />
              <NavItem to="/chat" label="Chat" />
              <NavItem to="/account" label="Account" />
              <button
                type="button"
                className="rounded-full border border-border-subtle px-3 py-1.5 text-sm text-text-secondary"
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </button>
            </nav>
          </div>
        </header>
      ) : null}
      <main className={userId ? 'mx-auto max-w-6xl px-4 py-6' : ''}>
        {isLoading ? (
          <div className="py-10 text-sm text-text-secondary">Loading...</div>
        ) : (
          <Outlet />
        )}
      </main>
      <Toaster />
    </div>
  );
}
