import { Spinner } from '@ponti-studios/ui/feedback';
import { Navigation } from '@ponti-studios/ui/navigation';
import { Button } from '@ponti-studios/ui/primitives';
import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

import { FinanceSearch } from '~/components/finance/finance-search';
import { useUser } from '~/lib/hooks/use-user';

import { Toaster } from '../lib/toast';

interface NavLink {
  href: string;
  label: string;
}

const LINKS: NavLink[] = [
  { href: '/finance', label: 'Finance' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/finance/affordability', label: 'Afford It?' },
  { href: '/finance/reconcile', label: 'Reconcile' },
  { href: '/finance/transfers', label: 'Transfers' },
];

function isActive(pathname: string, href: string) {
  if (href === pathname) return true;
  return href !== '/' && pathname.startsWith(`${href}/`);
}

function Header() {
  const location = useLocation();
  const user = useUser();
  const isAuthenticated = Boolean(user);

  const links: NavLink[] = isAuthenticated
    ? [...LINKS, { href: '/account', label: 'Account' }]
    : [];

  return (
    <Navigation className="relative">
      <Navigation.Brand>
        <Link to="/" className="inline-flex items-center" aria-label="Hominem Finance">
          <span className="text-primary" aria-hidden="true">
            <FinanceCoinMark />
          </span>
        </Link>
      </Navigation.Brand>

      <div className="ml-auto hidden min-w-0 items-center gap-5 sm:flex">
        <Navigation.List>
          {links.map((link) => (
            <Navigation.Item
              key={link.href}
              asChild
              active={isActive(location.pathname, link.href)}
            >
              <Link to={link.href}>{link.label}</Link>
            </Navigation.Item>
          ))}
        </Navigation.List>
        {isAuthenticated && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <FinanceSearch className="border-border bg-card text-primary hover:bg-muted" />
          </div>
        )}
        {!isAuthenticated && (
          <Button variant="outline" asChild>
            <Link to="/auth">Log in</Link>
          </Button>
        )}
      </div>
      {isAuthenticated && (
        <div className="ml-auto sm:hidden">
          <FinanceSearch className="border-border bg-card text-primary" />
        </div>
      )}
    </Navigation>
  );
}

function FinanceCoinMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
      <circle
        cx="12"
        cy="16"
        r="9"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="20"
        cy="16"
        r="9"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M6.5 14.5h11v3h-11zM10.5 10.5h3v11h-3z" fill="currentColor" />
      <path d="m7 11 10 10m0-10L7 21" stroke="var(--background)" strokeWidth="1" />
      <circle cx="20" cy="16" r="4.3" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M16.3 16h7.4m-3.7-3.7v7.4" stroke="currentColor" strokeWidth=".8" />
    </svg>
  );
}

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {pathname !== '/' && <Header />}
      <main
        className={
          pathname === '/'
            ? 'flex min-h-screen flex-1 flex-col'
            : 'mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6'
        }
      >
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
