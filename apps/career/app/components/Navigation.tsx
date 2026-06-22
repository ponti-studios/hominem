import { ChevronDown } from 'lucide-react';
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

const AUTHENTICATED_LINKS = [
  { href: '/applications', label: 'Applications', end: false },
  { href: '/account', label: 'Account', end: false },
] as const;

const navLinkClass = (isActive: boolean) =>
  cn(
    'px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap uppercase transition-colors',
    isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
  );

const pillShellClassName =
  'w-full max-w-6xl flex items-center justify-between rounded-full border border-border bg-card px-4 py-2 shadow-sm';

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

  const trailingLinks = isAuthenticated
    ? AUTHENTICATED_LINKS
    : [...PUBLIC_LINKS, ...UNAUTHENTICATED_LINKS];

  return (
    <header className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">
      <div className={cn(pillShellClassName, 'pointer-events-auto')}>
        <Link
          to="/"
          className="flex shrink-0 items-center px-2 text-sm font-semibold tracking-tight text-foreground"
        >
          Career
        </Link>

        <div className="flex items-center gap-1">
          {isAuthenticated ? (
            <>
              <nav className="hidden items-center gap-1 sm:flex" aria-label="Portfolio">
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

              <div className="relative sm:hidden" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setPortfolioOpen((prev) => !prev)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors',
                    isPortfolioActive
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="flex items-center gap-1">
                    Portfolio
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        portfolioOpen && 'rotate-180',
                      )}
                    />
                  </span>
                </button>

                {portfolioOpen && (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] w-52 rounded-3xl border border-border bg-card p-2 shadow-sm">
                    {PORTFOLIO_LINKS.map((link) => (
                      <NavLink
                        key={link.href}
                        to={link.href}
                        end={link.end}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center rounded-2xl px-3 py-2 text-xs font-semibold tracking-wide uppercase transition-colors',
                            isActive
                              ? 'bg-foreground text-background'
                              : 'text-muted-foreground hover:text-foreground',
                          )
                        }
                      >
                        {link.fullLabel}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {trailingLinks.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              end={link.end}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}
