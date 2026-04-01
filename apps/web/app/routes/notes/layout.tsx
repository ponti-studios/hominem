import { useAuth } from '@hominem/auth';
import { Navigate, Outlet } from 'react-router';

export default function NotesLayout() {
  const { userId, isLoading } = useAuth();

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
