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
    <header className="glass flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 pt-[env(safe-area-inset-top)] sm:px-5">
      <Link
        aria-label="Hominem home"
        className="group flex shrink-0 items-center gap-2.5"
        to="/"
        viewTransition
      >
        <span
          aria-hidden
          className="size-6 rounded-lg transition-transform duration-300 group-hover:rotate-[20deg]"
          style={{
            background: 'linear-gradient(135deg, #d7ff3e 10%, #5eead4 55%, #9d7bff 100%)',
            boxShadow: '0 0 20px -2px rgb(215 255 62 / 0.5)',
          }}
        />
        <span className="font-mono text-xs font-medium tracking-[0.2em] text-[#f2f4f8] uppercase">
          Hominem
        </span>
      </Link>

      {domain ? <span aria-hidden className="hidden h-4 w-px bg-white/10 sm:block" /> : null}

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
        <ol className="flex items-center gap-1 text-[13px]">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
                {i > 0 ? (
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 text-[#5e6678]" />
                ) : null}
                {isLast || !crumb.path ? (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className="truncate font-medium text-[#f2f4f8]"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    className="truncate text-[#9ba3b4] transition-colors hover:text-[#f2f4f8]"
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
        className="hairline group hidden items-center gap-2 rounded-full bg-white/[0.03] py-1.5 pr-2.5 pl-3 text-[13px] text-[#9ba3b4] transition-colors hover:border-white/20 hover:text-[#f2f4f8] sm:flex"
        onClick={onPaletteOpen}
        type="button"
      >
        <Command aria-hidden className="size-3.5" />
        <span>Jump to…</span>
        <kbd className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-[#c8cdd8]">
          ⌘K
        </kbd>
      </button>

      <button
        aria-label="Open navigation search"
        className="hairline flex size-9 items-center justify-center rounded-full text-[#9ba3b4] sm:hidden"
        onClick={onPaletteOpen}
        type="button"
      >
        <Command aria-hidden className="size-4" />
      </button>

      <AccountMenu user={user} />
    </header>
  );
}
