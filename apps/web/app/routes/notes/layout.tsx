'use client';

import { useSession } from '@hominem/auth/client';
import { Navigate, Outlet } from 'react-router';

export default function NotesLayout() {
  // Skip rendering on server
  if (typeof window === 'undefined') {
    return <div>Loading...</div>;
  }

  const session = useSession();
  const userId = session.data?.user?.id ?? null;
  const isLoading = session.isPending;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!userId) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex flex-col h-full">
      <Outlet />
    </div>
  );
}
