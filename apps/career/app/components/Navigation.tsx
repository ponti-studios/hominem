import { useLocation, Link, NavLink } from 'react-router';

import { useUser } from '../hooks/useAuth';
import { cn } from '~/lib/utils';

type NavItem = {
  href: string;
  label: string;
  end?: boolean;
};

type NavCategory = {
  id: string;
  label: string;
  links: readonly NavItem[];
};

const PORTFOLIO_CATEGORY: NavCategory = {
  id: 'portfolio',
  label: 'Portfolio',
  links: [
    { href: '/work', label: 'Work Experience' },
    { href: '/projects', label: 'Projects' },
    { href: '/skills', label: 'Skills', end: true },
    { href: '/social', label: 'Social & Links', end: true },
    { href: '/testimonials', label: 'Testimonials', end: true },
  ],
};

const JOB_SEARCH_CATEGORY: NavCategory = {
  id: 'search',
  label: 'Job Search',
  links: [{ href: '/applications', label: 'Applications' }],
};

const SETTINGS_CATEGORY: NavCategory = {
  id: 'settings',
  label: 'Settings',
  links: [
    { href: '/resume/custom', label: 'Resume', end: true },
    { href: '/account', label: 'Account', end: true },
  ],
};

const AUTHENTICATED_CATEGORIES = [
  PORTFOLIO_CATEGORY,
  JOB_SEARCH_CATEGORY,
  SETTINGS_CATEGORY,
] as const satisfies readonly NavCategory[];

const PUBLIC_LINKS = [
  { href: '/demo', label: 'Demo', end: true },
] as const satisfies readonly NavItem[];

const UNAUTHENTICATED_LINKS = [
  { href: '/login', label: 'Log in', end: true },
  { href: '/onboarding', label: 'Sign up', end: true },
] as const satisfies readonly NavItem[];

function getActiveCategoryId(pathname: string): string {
  // Determine which category the current route belongs to
  if (pathname.startsWith('/work')) return 'portfolio';
  if (pathname.startsWith('/projects')) return 'portfolio';
  if (pathname.startsWith('/skills')) return 'portfolio';
  if (pathname.startsWith('/social')) return 'portfolio';
  if (pathname.startsWith('/testimonials')) return 'portfolio';
  if (pathname.startsWith('/applications')) return 'search';
  if (pathname.startsWith('/account')) return 'settings';
  if (pathname.startsWith('/resume')) return 'settings';
  return 'portfolio'; // default
}

function CategoryTab({
  category,
  isActive,
  onClick,
}: {
  category: NavCategory;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors border-b-2',
        isActive
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {category.label}
    </button>
  );
}

function SubNavLink({ link }: { link: NavItem }) {
  return (
    <NavLink
      to={link.href}
      end={link.end}
      className={({ isActive }) =>
        cn(
          'block px-4 py-2 text-sm rounded-md transition-colors',
          isActive
            ? 'bg-muted text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )
      }
    >
      {link.label}
    </NavLink>
  );
}

function PublicNavigation() {
  return (
    <nav className="flex gap-4" aria-label="Public navigation">
      {PUBLIC_LINKS.map((link) => (
        <NavLink
          key={link.href}
          to={link.href}
          end={link.end}
          className={({ isActive }) =>
            cn(
              'px-3 py-2 text-sm font-medium rounded-md transition-colors',
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UnauthenticatedNav() {
  return (
    <nav className="flex gap-2" aria-label="Auth navigation">
      {UNAUTHENTICATED_LINKS.map((link) => (
        <NavLink
          key={link.href}
          to={link.href}
          end={link.end}
          className={({ isActive }) =>
            cn(
              'px-3 py-2 text-sm font-medium rounded-md transition-colors',
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Navigation() {
  const user = useUser();
  const location = useLocation();
  const isAuthenticated = Boolean(user);

  if (isAuthenticated) {
    const activeCategoryId = getActiveCategoryId(location.pathname);
    const activeCategory = AUTHENTICATED_CATEGORIES.find((cat) => cat.id === activeCategoryId);

    return (
      <header className="sticky top-0 z-50 bg-background border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Logo and top bar */}
          <div className="flex min-h-14 items-center gap-3">
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
          </div>

          {/* Category tabs */}
          <nav
            className="flex gap-1 border-t border-border/40 overflow-x-auto"
            aria-label="Main navigation categories"
          >
            {AUTHENTICATED_CATEGORIES.map((category) => (
              <Link
                key={category.id}
                to={category.links[0].href}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  activeCategoryId === category.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {category.label}
              </Link>
            ))}
          </nav>

          {/* Sub-navigation for active category */}
          {activeCategory && (
            <nav
              className="flex flex-wrap gap-2 py-3 border-t border-border/40"
              aria-label={`${activeCategory.label} navigation`}
            >
              {activeCategory.links.map((link) => (
                <SubNavLink key={link.href} link={link} />
              ))}
            </nav>
          )}
        </div>
      </header>
    );
  }

  // Unauthenticated view
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

        <div className="ml-auto flex items-center gap-4">
          <PublicNavigation />
          <UnauthenticatedNav />
        </div>
      </div>
    </header>
  );
}
