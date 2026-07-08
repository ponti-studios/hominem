import { Outlet } from 'react-router';

import { AuthRouteLayout } from '~/lib/ui-shims';

export default function AuthLayout() {
  return (
    <AuthRouteLayout>
      <Outlet />
    </AuthRouteLayout>
  );
}
