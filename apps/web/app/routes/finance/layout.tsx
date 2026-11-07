import { NavLink, Outlet } from 'react-router';

import { cn } from '~/lib/utils';
import { FinanceSearch } from '~/modules/finance/components/finance/finance-search';
import { Toaster } from '~/modules/finance/lib/toast';

const LINKS = [
  { to: '/finance', label: 'Overview', end: true },
  { to: '/finance/analytics', label: 'Analytics' },
  { to: '/finance/accounts', label: 'Accounts' },
  { to: '/finance/runway', label: 'Runway' },
  { to: '/finance/affordability', label: 'Afford it?' },
  { to: '/finance/reconcile', label: 'Reconcile' },
  { to: '/finance/transfers', label: 'Transfers' },
] as const;

export const meta = () => [{ title: 'Finance' }];

export default function FinanceLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
        <nav aria-label="Finance" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center gap-1 py-1.5">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'inline-flex h-8 items-center rounded-lg px-2.5 font-mono text-xs tracking-wide uppercase transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                  end={'end' in link ? link.end : false}
                  to={link.to}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden shrink-0 sm:block">
          <FinanceSearch />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </div>
      </div>

      <Toaster />
    </div>
  );
}
