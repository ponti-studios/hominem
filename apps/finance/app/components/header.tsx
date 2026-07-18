import { AppNavigation, type AppNavigationLink } from '@ponti-studios/ui/navigation';
import { Link, useLocation } from 'react-router';

import { useUser } from '~/lib/hooks/use-user';

const APP_NAME = 'Florin';
const LINKS: AppNavigationLink[] = [
  { href: '/finance', label: 'Finance' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/finance/affordability', label: 'Afford It?' },
];

const ACCOUNT_LINK: AppNavigationLink = { href: '/account', label: 'Account' };

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
      activeHref={location.pathname}
      linkComponent={Link}
      linkProp="to"
    />
  );
}
