import { Command } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router';

import { AccountMenu } from '~/components/account-menu';
import { ENABLED_DOMAINS } from '~/domains';
import type { User } from '~/lib/auth.server';
import { domainForPath } from '~/lib/navigation';

import { AppNavLink } from './app-nav-link';

type AppSidebarProps = {
  pathname: string;
  user: User;
  onPaletteOpen: () => void;
  mobile?: boolean;
  onNavigate?: () => void;
};

export const AppSidebar = memo(function AppSidebar({
  pathname,
  user,
  onPaletteOpen,
  mobile = false,
  onNavigate,
}: AppSidebarProps) {
  const activeDomain = domainForPath(pathname);
  const className = mobile
    ? 'flex h-full w-full flex-col gap-1 overflow-y-auto p-3'
    : 'hidden h-full w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border p-3 md:flex';

  return (
    <aside className={className}>
      <Link
        aria-label="Hominem home"
        className="mb-5 flex min-h-10 shrink-0 items-center gap-2.5 px-3"
        onClick={onNavigate}
        to="/"
        viewTransition
      >
        <span aria-hidden className="size-6 rounded-sm bg-primary" />
        <span className="font-mono text-xs font-medium tracking-[0.2em] text-foreground uppercase">
          Hominem
        </span>
      </Link>

      <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col gap-0.5">
        {ENABLED_DOMAINS.map((domain) => {
          const Icon = domain.icon;
          const subNav =
            activeDomain?.id === domain.id
              ? domain.subNav.filter((item) => item.path !== domain.path)
              : [];

          return (
            <div key={domain.id}>
              <AppNavLink
                activeContext={activeDomain?.id === domain.id}
                end={domain.subNav.length > 0}
                icon={<Icon />}
                label={domain.label}
                onNavigate={onNavigate}
                prefetch="intent"
                to={domain.path}
              />
              {subNav.length > 0 ? (
                <div className="mt-1 mb-2 flex flex-col gap-0.5">
                  {subNav.map((item) => (
                    <AppNavLink
                      key={item.path}
                      end={item.end}
                      label={item.label}
                      onNavigate={onNavigate}
                      prefetch="intent"
                      to={item.path}
                      variant="nested"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="mt-3 flex shrink-0 items-center gap-2 border-t border-border px-2 pt-3">
        <button
          className="hairline flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onPaletteOpen}
          type="button"
        >
          <Command aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>
        <AccountMenu user={user} />
      </div>
    </aside>
  );
});

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}
