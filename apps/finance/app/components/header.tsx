import { AppNavigation, type AppNavigationLink } from '@hominem/ui';
import { ChartLine, CircleDollarSign, Landmark } from 'lucide-react';
import { Link, useLocation } from 'react-router';

const APP_NAME = 'Finance';
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

export default function FinanceHeader() {
  const location = useLocation();

  return (
    <AppNavigation
      brand={
        <span className="inline-flex items-center gap-2">
          <img src="/logo-finance.png" alt="" className="size-5" />
          {APP_NAME}
        </span>
      }
      brandHref="/"
      links={LINKS}
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
