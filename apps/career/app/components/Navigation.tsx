import { AppNavigation, type AppNavigationLink } from '@hominem/ui';
import {
  BriefcaseBusinessIcon,
  ClipboardListIcon,
  EyeIcon,
  FolderKanbanIcon,
  LogInIcon,
  MessageSquareQuoteIcon,
  SparklesIcon,
  UserRoundIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { useHasPortfolio, useUser } from '../hooks/useAuth';

const iconClass = 'size-4';

const PORTFOLIO_LINKS: AppNavigationLink[] = [
  {
    href: '/work',
    label: 'Work',
    icon: <BriefcaseBusinessIcon className={iconClass} aria-hidden />,
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: <FolderKanbanIcon className={iconClass} aria-hidden />,
  },
  {
    href: '/skills',
    label: 'Skills',
    icon: <SparklesIcon className={iconClass} aria-hidden />,
  },
  {
    href: '/testimonials',
    label: 'Testimonials',
    icon: <MessageSquareQuoteIcon className={iconClass} aria-hidden />,
  },
];

const PUBLIC_LINKS: AppNavigationLink[] = [
  { href: '/demo', label: 'Demo', icon: <EyeIcon className={iconClass} aria-hidden /> },
];

const AUTHENTICATED_LINKS: AppNavigationLink[] = [
  {
    href: '/applications',
    label: 'Applications',
    icon: <ClipboardListIcon className={iconClass} aria-hidden />,
  },
  {
    href: '/account',
    label: 'Account',
    icon: <UserRoundIcon className={iconClass} aria-hidden />,
  },
];

export default function Navigation() {
  const user = useUser();
  const hasPortfolio = useHasPortfolio();
  const location = useLocation();
  const isAuthenticated = Boolean(user);

  const links: AppNavigationLink[] = isAuthenticated
    ? hasPortfolio
      ? [...PORTFOLIO_LINKS, ...AUTHENTICATED_LINKS]
      : []
    : PUBLIC_LINKS;

  const cta = isAuthenticated
    ? undefined
    : {
        href: '/login',
        label: 'Log in',
        variant: 'outline' as const,
        icon: <LogInIcon className={iconClass} aria-hidden />,
      };

  return (
    <AppNavigation
      brand="Career"
      brandHref="/"
      links={links}
      cta={cta}
      linksDisplay="icon"
      activeHref={location.pathname}
      renderLink={({ href, className, children, title, 'aria-label': ariaLabel }) => (
        <Link key={href} to={href} className={className} title={title} aria-label={ariaLabel}>
          {children}
        </Link>
      )}
    />
  );
}
