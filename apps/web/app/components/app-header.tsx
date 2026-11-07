import { Link, NavLink } from 'react-router';

import { AccountMenu } from '~/components/account-menu';
import { ENABLED_DOMAINS } from '~/domains';
import type { User } from '~/lib/auth.server';
import { cn } from '~/lib/utils';

export function AppHeader({ user }: { user: User }) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-4 border-b border-border px-4 pt-safe-area-inset-top sm:gap-6 sm:px-6">
      <Link
        aria-label="Hominem home"
        className="font-mono text-xs font-medium tracking-[0.2em] uppercase"
        to="/"
      >
        Hominem
      </Link>

      <nav aria-label="Domains" className="min-w-0 flex-1 overflow-x-auto">
        <ul className="flex items-center gap-1">
          {ENABLED_DOMAINS.map((domain) => (
            <li key={domain.id}>
              <NavLink
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-8 items-center rounded-lg px-2.5 font-mono text-xs tracking-wide uppercase transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
                to={domain.path}
              >
                {domain.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <AccountMenu user={user} />
    </header>
  );
}
