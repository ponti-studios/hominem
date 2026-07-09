import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hominem/ui';
import {
  BriefcaseBusinessIcon,
  ClipboardListIcon,
  EyeIcon,
  FolderKanbanIcon,
  LogInIcon,
  MenuIcon,
  MessageSquareQuoteIcon,
  SparklesIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { cn } from '~/lib/utils';

import { useHasPortfolio, useUser } from '../hooks/useAuth';

type NavItem = {
  href: string;
  label: string;
  end: boolean;
  icon: LucideIcon;
};

const PORTFOLIO_LINKS: readonly NavItem[] = [
  {
    href: '/work',
    label: 'Work',
    end: false,
    icon: BriefcaseBusinessIcon,
  },
  {
    href: '/projects',
    label: 'Projects',
    end: false,
    icon: FolderKanbanIcon,
  },
  {
    href: '/skills',
    label: 'Skills',
    end: true,
    icon: SparklesIcon,
  },
  {
    href: '/testimonials',
    label: 'Testimonials',
    end: true,
    icon: MessageSquareQuoteIcon,
  },
] as const;

const PUBLIC_LINKS: readonly NavItem[] = [
  { href: '/demo', label: 'Demo', end: true, icon: EyeIcon },
] as const;

const UNAUTHENTICATED_LINKS: readonly NavItem[] = [
  { href: '/login', label: 'Log in', end: true, icon: LogInIcon },
] as const;

const AUTHENTICATED_LINKS: readonly NavItem[] = [
  {
    href: '/applications',
    label: 'Applications',
    end: false,
    icon: ClipboardListIcon,
  },
  {
    href: '/account',
    label: 'Account',
    end: false,
    icon: UserRoundIcon,
  },
] as const;

const iconLinkClass = (isActive: boolean) =>
  cn(
    'inline-flex size-9 items-center justify-center rounded-full transition-colors',
    isActive
      ? 'bg-foreground text-background'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

const menuItemClass = (isActive: boolean) =>
  cn(
    'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-foreground text-background'
      : 'text-foreground hover:bg-muted focus:bg-muted',
  );

function isLinkActive(pathname: string, href: string, end: boolean) {
  return end ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function IconNavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.href}
      end={item.end}
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) => iconLinkClass(isActive)}
    >
      <Icon className="size-4" aria-hidden />
    </NavLink>
  );
}

export default function Navigation() {
  const user = useUser();
  const hasPortfolio = useHasPortfolio();
  const location = useLocation();
  const isAuthenticated = Boolean(user);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Portfolio-gated product links only when the user can actually open them.
  const primaryLinks = isAuthenticated && hasPortfolio ? PORTFOLIO_LINKS : [];
  const trailingLinks = isAuthenticated
    ? hasPortfolio
      ? AUTHENTICATED_LINKS
      : []
    : [...PUBLIC_LINKS, ...UNAUTHENTICATED_LINKS];
  const menuLinks = [...primaryLinks, ...trailingLinks];
  const showNav = menuLinks.length > 0;

  const menuHasActive = menuLinks.some((link) =>
    isLinkActive(location.pathname, link.href, link.end),
  );

  return (
    <header className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-6xl items-center justify-between rounded-full border border-border bg-card px-3 py-1.5 shadow-sm sm:px-4',
        )}
      >
        <Link
          to="/"
          className="flex shrink-0 items-center px-2 text-sm font-semibold tracking-tight text-foreground"
        >
          Career
        </Link>

        {showNav ? (
          <>
            {/* md+: icon row */}
            <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
              {primaryLinks.map((link) => (
                <IconNavLink key={link.href} item={link} />
              ))}
              {primaryLinks.length > 0 && trailingLinks.length > 0 ? (
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              ) : null}
              {trailingLinks.map((link) => (
                <IconNavLink key={link.href} item={link} />
              ))}
            </nav>

            {/* < md: collapse right side into menu */}
            <div className="md:hidden">
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open menu"
                    title="Menu"
                    className={iconLinkClass(menuHasActive && !menuOpen)}
                  >
                    <MenuIcon className="size-4" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={12}
                  className="w-56 rounded-2xl border-border p-2 shadow-md"
                >
                  {isAuthenticated && hasPortfolio ? (
                    <>
                      <DropdownMenuLabel className="px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Portfolio
                      </DropdownMenuLabel>
                      {PORTFOLIO_LINKS.map((link) => (
                        <MenuNavItem key={link.href} item={link} pathname={location.pathname} />
                      ))}
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuLabel className="px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Account
                      </DropdownMenuLabel>
                      {AUTHENTICATED_LINKS.map((link) => (
                        <MenuNavItem key={link.href} item={link} pathname={location.pathname} />
                      ))}
                    </>
                  ) : (
                    menuLinks.map((link) => (
                      <MenuNavItem key={link.href} item={link} pathname={location.pathname} />
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}

function MenuNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = isLinkActive(pathname, item.href, item.end);

  return (
    <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
      <NavLink to={item.href} end={item.end} className={menuItemClass(active)}>
        <Icon className="size-4 shrink-0" aria-hidden />
        <span>{item.label}</span>
      </NavLink>
    </DropdownMenuItem>
  );
}
