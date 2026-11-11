import { ChevronRight, Command } from 'lucide-react';
import { Link } from 'react-router';

import { AccountMenu } from '~/components/account-menu';
import type { User } from '~/lib/auth.server';
import { domainForPath } from '~/lib/navigation';

type AppTopbarProps = {
  user: User;
  pathname: string;
  onPaletteOpen: () => void;
  crumbs: { label: string; path?: string }[];
};

export function AppTopbar({ user, pathname, onPaletteOpen, crumbs }: AppTopbarProps) {
  const domain = domainForPath(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 pt-[env(safe-area-inset-top)] sm:px-5">
      <Link
        aria-label="Hominem home"
        className="group flex shrink-0 items-center gap-2.5"
        to="/"
        viewTransition
      >
        <span
          aria-hidden
          className="size-6 rounded-sm bg-primary"
          style={{
            background: 'var(--primary)',
          }}
        />
        <span className="font-mono text-xs font-medium tracking-[0.2em] text-foreground uppercase">
          Hominem
        </span>
      </Link>

      {domain ? <span aria-hidden className="hidden h-4 w-px bg-border sm:block" /> : null}

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
        <ol className="flex items-center gap-1 text-[13px]">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
                {i > 0 ? (
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                ) : null}
                {isLast || !crumb.path ? (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className="truncate font-medium text-foreground"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    className="truncate text-muted-foreground transition-colors hover:text-foreground"
                    to={crumb.path}
                    viewTransition
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <button
        className="hairline group hidden items-center gap-2 rounded-sm bg-muted py-1.5 pr-2.5 pl-3 text-[13px] text-muted-foreground transition-colors hover:border-border hover:text-foreground sm:flex"
        onClick={onPaletteOpen}
        type="button"
      >
        <Command aria-hidden className="size-3.5" />
        <span>Jump to…</span>
        <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <button
        aria-label="Open navigation search"
        className="hairline flex size-9 items-center justify-center rounded-full text-muted-foreground sm:hidden"
        onClick={onPaletteOpen}
        type="button"
      >
        <Command aria-hidden className="size-4" />
      </button>

      <AccountMenu user={user} />
    </header>
  );
}
