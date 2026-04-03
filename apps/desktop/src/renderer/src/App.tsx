import { type AuthConfig, AuthProvider, useSession } from '@hominem/auth/client';
import { Navigate, Route, Routes } from 'react-router';

import { desktopEnv } from '@/lib/env';

import { AppShell } from './app-shell';
import AuthRoute from './routes/auth';
import AuthVerifyRoute from './routes/auth-verify';

const authConfig: AuthConfig = {
  apiBaseUrl: desktopEnv.VITE_PUBLIC_API_URL,
};

export function App() {
  return (
    <AuthProvider config={authConfig}>
      <Routes>
        <Route path="/auth" Component={AuthRoute} />
        <Route path="/auth/verify" Component={AuthVerifyRoute} />
        <Route
          path="/app-shell"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/auth" />} />
      </Routes>
    </AuthProvider>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const isAuthenticated = Boolean(session.data?.user?.id);
  const isLoading = session.isPending;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
