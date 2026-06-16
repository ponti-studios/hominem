import { ChevronDown, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { cn } from '~/lib/utils';

import { useUser } from '../hooks/useAuth';

const PORTFOLIO_LINKS = [
  { href: '/work', label: 'Work', fullLabel: 'Work Experience', end: false },
  { href: '/projects', label: 'Projects', fullLabel: 'Projects', end: false },
  { href: '/skills', label: 'Skills', fullLabel: 'Skills', end: true },
  { href: '/social', label: 'Social', fullLabel: 'Social & Links', end: true },
  { href: '/testimonials', label: 'Testimonials', fullLabel: 'Testimonials', end: true },
] as const;

const PUBLIC_LINKS = [{ href: '/demo', label: 'Demo', end: true }] as const;

const UNAUTHENTICATED_LINKS = [
  { href: '/login', label: 'Log in', end: true },
  { href: '/onboarding', label: 'Sign up', end: true },
] as const;

const navLinkClass = (isActive: boolean) =>
  cn(
    'flex h-14 items-center px-3 text-sm whitespace-nowrap border-b-2 transition-colors',
    isActive
      ? 'border-foreground text-foreground font-medium'
      : 'border-transparent text-muted-foreground',
  );

export default function Navigation() {
  const user = useUser();
  const location = useLocation();
  const isAuthenticated = Boolean(user);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPortfolioOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    setPortfolioOpen(false);
  }, [location.pathname]);

  const isPortfolioActive = PORTFOLIO_LINKS.some((link) =>
    link.end ? location.pathname === link.href : location.pathname.startsWith(link.href),
  );
  const isAccountActive = location.pathname.startsWith('/account');

  if (!isAuthenticated) {
    return (
      <header className="sticky top-0 z-50 border-b border-border/40 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center text-foreground">
            <img
              src="/icons/icon-192x192.png"
              alt="Career logo"
              className="h-8 w-auto rounded-md"
              width="32"
              height="32"
            />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {PUBLIC_LINKS.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            {UNAUTHENTICATED_LINKS.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-stretch">
          {/* Logo */}
          <Link to="/" className="mr-2 flex shrink-0 items-center pr-4 text-foreground">
            <img
              src="/icons/icon-192x192.png"
              alt="Career logo"
              className="h-6 w-auto rounded-md"
              width="32"
              height="32"
            />
          </Link>

          {/* Desktop: portfolio links inline */}
          <nav className="hidden sm:flex items-stretch" aria-label="Portfolio">
            {PORTFOLIO_LINKS.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                end={link.end}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile: Portfolio dropdown */}
          <div className="sm:hidden flex items-center" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setPortfolioOpen((prev) => !prev)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors font-medium',
                isPortfolioActive ? 'text-foreground bg-muted' : 'text-muted-foreground',
              )}
            >
              Portfolio
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', portfolioOpen && 'rotate-180')}
              />
            </button>

            {portfolioOpen && (
              <div className="absolute left-4 top-14 w-48 rounded-lg border border-border bg-background shadow-lg py-1 z-50">
                {PORTFOLIO_LINKS.map((link) => (
                  <NavLink
                    key={link.href}
                    to={link.href}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center px-3 py-2 text-sm transition-colors',
                        isActive ? 'text-foreground font-medium bg-muted' : 'text-muted-foreground',
                      )
                    }
                  >
                    {link.fullLabel}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center mx-2 shrink-0">
            <div className="w-px h-4 bg-border" />
          </div>

          {/* Applications — always visible */}
          <NavLink to="/applications" className={({ isActive }) => navLinkClass(isActive)}>
            Applications
          </NavLink>

          <div className="flex-1" />

          {/* Account icon */}
          <div className="flex items-center">
            <Link
              to="/account"
              aria-label="Account settings"
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-full transition-colors',
                isAccountActive ? 'bg-muted text-foreground' : 'text-muted-foreground',
              )}
            >
              <User className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
