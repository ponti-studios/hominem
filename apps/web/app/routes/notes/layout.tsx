import { useAuthContext } from '@hominem/auth';
import { Navigate, Outlet, useLocation } from 'react-router';

import { buildAuthRedirectPath } from '~/lib/auth-redirect';

export default function NotesLayout() {
  const { userId, isLoading } = useAuthContext();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!userId) {
    return (
      <Navigate to={buildAuthRedirectPath(`${location.pathname}${location.search}`)} replace />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Outlet />
    </div>
  );
}
