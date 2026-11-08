import { Outlet } from 'react-router';

import { Container } from '~/components/design/container';
import { AppNavLink } from '~/components/shell/app-nav-link';
import { DOMAINS } from '~/domains';
import { FinanceSearch } from '~/modules/finance/components/finance/finance-search';

const FINANCE = DOMAINS.find((d) => d.id === 'finance');

export const meta = () => [{ title: 'Finance' }];

export default function FinanceLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="glass flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 sm:px-6">
        <nav aria-label="Finance" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center gap-1 py-2">
            {FINANCE?.subNav.map((link) => (
              <li key={link.path} className="shrink-0">
                <AppNavLink
                  accent={FINANCE.accent}
                  end={link.end}
                  label={link.label}
                  prefetch="intent"
                  to={link.path}
                  variant="pill"
                />
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden shrink-0 sm:block">
          <FinanceSearch />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Container size="lg">
          <Outlet />
        </Container>
      </div>
    </div>
  );
}
