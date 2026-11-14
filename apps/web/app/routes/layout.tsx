import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, data, useLocation, useNavigate } from 'react-router';

import { AppSidebar } from '~/components/shell/app-sidebar';
import { AppTopbar } from '~/components/shell/app-topbar';
import { CommandPalette } from '~/components/shell/command-palette';
import { RouteTransition } from '~/components/shell/route-transition';
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
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
  const [navigationOpen, setNavigationOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let pendingG = false;
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
        if (timerRef.current) clearTimeout(timerRef.current);
        const path = GO_SEQUENCES[event.key.toLowerCase()];
        if (path) {
          event.preventDefault();
          void navigate(path, { viewTransition: true });
        }
        return;
      }
      if (event.key.toLowerCase() === 'g' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        pendingG = true;
        timerRef.current = setTimeout(() => {
          pendingG = false;
        }, 800);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timerRef.current);
    };
  }, [paletteOpen]);

  return (
    <div className="flex h-[100svh] min-h-[100svh] w-full flex-row overflow-hidden bg-transparent text-foreground">
      {user ? (
        <AppSidebar onPaletteOpen={openPalette} pathname={location.pathname} user={user} />
      ) : null}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {user ? (
          <AppTopbar
            onNavigationOpen={() => setNavigationOpen(true)}
            pageTitle={crumbs.at(-1)?.label ?? 'Home'}
          />
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </div>
      </main>
      {user ? (
        <Dialog onOpenChange={setNavigationOpen} open={navigationOpen}>
          <DialogContent
            className="!top-0 !left-0 !h-[100dvh] !w-72 !max-w-[85vw] !translate-x-0 !translate-y-0 !gap-0 !rounded-none !p-0 !ring-0 md:hidden"
            showCloseButton
          >
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <AppSidebar
              mobile
              onPaletteOpen={openPalette}
              onNavigate={() => setNavigationOpen(false)}
              pathname={location.pathname}
              user={user}
            />
          </DialogContent>
        </Dialog>
      ) : null}
      <CommandPalette onClose={closePalette} open={paletteOpen} />
      <Toaster />
    </div>
  );
}
