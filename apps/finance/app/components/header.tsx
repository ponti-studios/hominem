import { AppNavigation, type AppNavigationLink } from '@hominem/ui';
import { ChartLine, CircleDollarSign, Landmark, LogInIcon, UserRoundIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { useUser } from '~/lib/hooks/use-user';

const APP_NAME = 'Florin';
const iconClass = 'size-4';

const LINKS: AppNavigationLink[] = [
  {
    href: '/finance',
    label: 'Finance',
    icon: <CircleDollarSign className={iconClass} aria-hidden />,
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: <ChartLine className={iconClass} aria-hidden />,
  },
  {
    href: '/accounts',
    label: 'Accounts',
    icon: <Landmark className={iconClass} aria-hidden />,
  },
];

const ACCOUNT_LINK: AppNavigationLink = {
  href: '/account',
  label: 'Account',
  icon: <UserRoundIcon className={iconClass} aria-hidden />,
};

export default function FinanceHeader() {
  const location = useLocation();
  const user = useUser();
  const isAuthenticated = Boolean(user);

  const links = isAuthenticated ? [...LINKS, ACCOUNT_LINK] : [];
  const cta = isAuthenticated
    ? undefined
    : {
        href: '/auth',
        label: 'Log in',
        variant: 'outline' as const,
        icon: <LogInIcon className={iconClass} aria-hidden />,
      };

  return (
    <AppNavigation
      brand={
        <span className="inline-flex items-center gap-2">
          <img src="/logo-finance.png" alt="" className="size-5" />
          {APP_NAME}
        </span>
      }
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
