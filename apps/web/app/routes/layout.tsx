import { cn } from '@hominem/ui/lib/utils';
import { Link, NavLink, Outlet, data } from 'react-router';

import { getServerSession } from '~/lib/auth.server';
import { WEB_BRAND } from '~/lib/brand';

import type { Route } from './+types/layout';

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(`rounded-full px-3 py-1.5 text-sm`, {
          'bg-foreground text-background': isActive,
          'text-text-secondary': !isActive,
        })
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
    <div className="flex flex-col bg-background text-foreground max-w-5xl mx-auto px-4 lg:px-0">
      {userId ? (
        <header className="border-b border-border-subtle bg-background/90 backdrop-blur">
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <Link to="/" className="text-xs uppercase tracking-[0.2em] text-text-tertiary">
                {WEB_BRAND.appName}
              </Link>
            </div>
            <nav className="flex items-center gap-2">
              <NavItem to="/inbox" label="Inbox" />
              <NavItem to="/account" label="Account" />
            </nav>
          </div>
        </header>
      ) : null}
      <main className="flex min-h-0 w-full flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
