import { Outlet } from 'react-router';

import { Container } from '~/components/design/container';
import { FinanceSearch } from '~/modules/finance/components/finance/finance-search';

export const meta = () => [{ title: 'Finance' }];

export default function FinanceLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="hidden shrink-0 justify-end px-4 py-2 sm:flex sm:px-6">
        <FinanceSearch />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Container size="lg">
          <Outlet />
        </Container>
      </div>
    </div>
  );
}
