import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, data, useLocation, useNavigate } from 'react-router';

import { AppSidebar } from '~/components/shell/app-sidebar';
import { AppTopbar } from '~/components/shell/app-topbar';
import { CommandPalette } from '~/components/shell/command-palette';
import { RouteTransition } from '~/components/shell/route-transition';
import { ENABLED_DOMAINS } from '~/domains';
import { userContext } from '~/lib/middleware';
import { GO_SEQUENCES, domainForPath } from '~/lib/navigation';
import { Toaster } from '~/modules/finance/lib/toast';

import type { Route } from './+types/layout';

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  return data({ user });
}

function prettify(segment: string): string {
  return segment
    .split('-')
    .map((part) => (part ? part[0]?.toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function useCrumbs(pathname: string) {
  return useMemo(() => {
    const domain = domainForPath(pathname);
    if (!domain) {
      const seg = pathname.split('/').filter(Boolean).pop();
      return [{ label: seg ? prettify(seg) : 'Home' }];
    }
    const sub = [...domain.subNav]
      .sort((a, b) => b.path.length - a.path.length)
      .find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`));
    const crumbs: { label: string; path?: string }[] = [{ label: domain.label, path: domain.path }];
    if (sub && sub.path !== domain.path) crumbs.push({ label: sub.label, path: sub.path });
    const rest = pathname
      .slice((sub?.path ?? domain.path).length)
      .split('/')
      .filter(Boolean);
    for (const segment of rest) crumbs.push({ label: prettify(segment) });
    return crumbs;
  }, [pathname]);
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = useCrumbs(location.pathname);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout>;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (typing || paletteOpen) return;
      if (pendingG) {
        pendingG = false;
        clearTimeout(timer);
        const path = GO_SEQUENCES[event.key.toLowerCase()];
        if (path) {
          event.preventDefault();
          void navigate(path, { viewTransition: true });
        }
        return;
      }
      if (event.key.toLowerCase() === 'g' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        pendingG = true;
        timer = setTimeout(() => {
          pendingG = false;
        }, 800);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen]);

  return (
    <div className="flex h-[100svh] min-h-[100svh] w-full flex-col overflow-hidden bg-transparent text-[#f2f4f8]">
      {user ? (
        <AppTopbar
          crumbs={crumbs}
          onPaletteOpen={openPalette}
          pathname={location.pathname}
          user={user}
        />
      ) : null}
      <div className="flex min-h-0 flex-1">
        {user ? <AppSidebar /> : null}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </main>
      </div>
      {user ? <MobileTabBar pathname={location.pathname} /> : null}
      <CommandPalette onClose={closePalette} open={paletteOpen} />
      <Toaster />
    </div>
  );
}

function MobileTabBar({ pathname }: { pathname: string }) {
  const domain = domainForPath(pathname);
  return (
    <nav
      aria-label="Domains"
      className="glass flex shrink-0 items-stretch justify-around border-t border-white/[0.06] px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {ENABLED_DOMAINS.map((d) => {
        const Icon = d.icon;
        const active = domain?.id === d.id;
        return (
          <a
            key={d.id}
            aria-current={active ? 'page' : undefined}
            className="flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5"
            href={d.path}
          >
            <span
              className="flex size-8 items-center justify-center rounded-full transition-all"
              style={
                active
                  ? {
                      background: `${d.accent}26`,
                      color: d.accent,
                      boxShadow: `0 0 16px -2px ${d.accent}66`,
                    }
                  : { color: '#5e6678' }
              }
            >
              <Icon aria-hidden className="size-[18px]" />
            </span>
            <span
              className="font-mono text-[9px] tracking-[0.12em] uppercase"
              style={{ color: active ? '#f2f4f8' : '#5e6678' }}
            >
              {d.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
