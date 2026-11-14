import { Outlet } from 'react-router';

import { Container } from '~/components/design/container';

export const meta = () => [{ title: 'Finance' }];

export default function FinanceLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        <Container size="lg">
          <Outlet />
        </Container>
      </div>
    </div>
  );
}
