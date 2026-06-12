import { Button } from '@hominem/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@hominem/ui/drawer';
import { cn } from '@hominem/ui/lib/utils';
import { MenuIcon } from 'lucide-react';
import { Link, NavLink } from 'react-router';

import { useUser } from '../hooks/useAuth';

type NavItem = {
  href: string;
  label: string;
  end?: boolean;
};

const AUTHENTICATED_LINKS = [
  { href: '/work', label: 'Work' },
  { href: '/applications', label: 'Applications' },
  { href: '/projects', label: 'Projects', end: true },
  { href: '/skills', label: 'Skills', end: true },
] as const satisfies readonly NavItem[];

const PUBLIC_LINKS = [
  { href: '/demo', label: 'Demo', end: true },
] as const satisfies readonly NavItem[];

const ACCOUNT_LINK = { href: '/account', label: 'Account', end: true } as const satisfies NavItem;

const UNAUTHENTICATED_LINKS = [
  { href: '/login', label: 'Log in', end: true },
  { href: '/onboarding', label: 'Sign up', end: true },
] as const satisfies readonly NavItem[];

function navigationLinkClassName(variant: 'desktop' | 'mobile') {
  return ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex min-w-0 items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      variant === 'desktop'
        ? 'w-full justify-center whitespace-nowrap px-3 py-2 text-center'
        : 'w-full justify-start px-4 py-3',
      isActive
        ? 'bg-muted text-foreground'
        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
    );
}

function NavigationLink({ link, variant }: { link: NavItem; variant: 'desktop' | 'mobile' }) {
  return (
    <NavLink to={link.href} end={link.end} className={navigationLinkClassName(variant)}>
      {link.label}
    </NavLink>
  );
}

function DesktopNavigation({ links }: { links: readonly NavItem[] }) {
  return (
    <nav className="grid w-full grid-flow-col auto-cols-fr gap-2" aria-label="Site navigation">
      {links.map((link) => (
        <NavigationLink key={link.href} link={link} variant="desktop" />
      ))}
    </nav>
  );
}

function MobileNavigation({
  primaryLinks,
  secondaryLinks,
}: {
  primaryLinks: readonly NavItem[];
  secondaryLinks: readonly NavItem[];
}) {
  return (
    <div className="flex flex-col gap-6 p-4">
      <nav className="flex flex-col gap-2" aria-label="Primary navigation">
        {primaryLinks.map((link) => (
          <DrawerClose key={link.href} asChild>
            <NavigationLink link={link} variant="mobile" />
          </DrawerClose>
        ))}
      </nav>

      {secondaryLinks.length > 0 ? (
        <nav
          className="flex flex-col gap-2 border-t border-border pt-4"
          aria-label="Secondary navigation"
        >
          {secondaryLinks.map((link) => (
            <DrawerClose key={link.href} asChild>
              <NavigationLink link={link} variant="mobile" />
            </DrawerClose>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function getPrimaryLinks(isAuthenticated: boolean): readonly NavItem[] {
  if (isAuthenticated) {
    return AUTHENTICATED_LINKS;
  }

  return PUBLIC_LINKS;
}

function getSecondaryLinks(isAuthenticated: boolean): readonly NavItem[] {
  if (!isAuthenticated) {
    return UNAUTHENTICATED_LINKS;
  }

  return [ACCOUNT_LINK];
}

export default function Navigation() {
  const user = useUser();
  const isAuthenticated = Boolean(user);
  const primaryLinks = getPrimaryLinks(isAuthenticated);
  const secondaryLinks = getSecondaryLinks(isAuthenticated);
  const desktopLinks = [...primaryLinks, ...secondaryLinks];

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <img
            src="/icons/icon-192x192.png"
            alt="Career logo"
            className="h-10 w-auto rounded-md"
            width="40"
            height="40"
          />
        </Link>

        <div className="ml-auto flex flex-1 items-center justify-end gap-3">
          <div className="hidden min-w-0 flex-1 md:flex">
            <DesktopNavigation links={desktopLinks} />
          </div>

          <Drawer direction="right">
            <DrawerTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
                aria-label="Open navigation menu"
              >
                <MenuIcon className="size-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-full max-h-none rounded-none border-l bg-background p-0">
              <DrawerHeader className="border-b border-border px-4 py-4">
                <DrawerTitle>Menu</DrawerTitle>
              </DrawerHeader>

              <MobileNavigation primaryLinks={primaryLinks} secondaryLinks={secondaryLinks} />
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </header>
  );
}
