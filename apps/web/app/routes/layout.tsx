import { Toaster } from '@hominem/ui';
import { NavLink, Outlet, data } from 'react-router';

import { WEB_BRAND } from '~/lib/brand';
import { getServerSession } from '~/lib/auth.server';
import type { Route } from './+types/layout';

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

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await getServerSession(request);
  return data({ userId: user?.id ?? null }, { headers });
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { userId } = loaderData;

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
            </nav>
          </div>
        </header>
      ) : null}
      <main className={userId ? 'mx-auto max-w-6xl px-4 py-6' : ''}>
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
