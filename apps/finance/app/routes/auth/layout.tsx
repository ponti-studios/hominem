import { AuthRouteLayout } from '~/lib/ui-shims';
import { Outlet } from 'react-router';

export default function AuthLayout() {
  return (
    <AuthRouteLayout>
      <Outlet />
    </AuthRouteLayout>
  );
}
