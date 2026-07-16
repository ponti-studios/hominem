import { AppNavigation, type AppNavigationLink } from '@ponti-studios/ui/navigation';
import { Link, useLocation } from 'react-router';

import { useHasPortfolio, useUser } from '../hooks/useAuth';

const PORTFOLIO_LINKS: AppNavigationLink[] = [
  { href: '/work', label: 'Work' },
  { href: '/projects', label: 'Projects' },
  { href: '/skills', label: 'Skills' },
  { href: '/testimonials', label: 'Testimonials' },
];

const PUBLIC_LINKS: AppNavigationLink[] = [{ href: '/demo', label: 'Demo' }];

const AUTHENTICATED_LINKS: AppNavigationLink[] = [
  { href: '/applications', label: 'Applications' },
  { href: '/account', label: 'Account' },
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
        href: '/auth',
        label: 'Log in',
        variant: 'outline' as const,
      };

  return (
    <AppNavigation
      brand="Career"
      brandHref="/"
      links={links}
      cta={cta}
      activeHref={location.pathname}
      linkComponent={Link}
      linkProp="to"
    />
  );
}
