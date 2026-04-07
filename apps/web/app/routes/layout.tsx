import { useAuthClient, useSession } from '@hominem/auth/client';
import { Toaster } from '@hominem/ui';
import { useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-full px-3 py-1.5 text-sm ${isActive ? 'bg-foreground text-background' : 'text-text-secondary'}`
      }
    >
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const authClient = useAuthClient();
  const navigate = useNavigate();
  const session = useSession();
  const userId = session.data?.user?.id ?? null;
  const isLoading = session.isPending;
  const signOut = useCallback(async () => {
    const result = await authClient.signOut();
    if (result.error) {
      throw new Error(result.error.message ?? 'Unable to sign out.');
    }
    navigate('/auth');
  }, [authClient, navigate]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {userId ? (
        <header className="border-b border-border-subtle bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Hominem</p>
            </div>
            <nav className="flex items-center gap-2">
              <NavItem to="/notes" label="Notes" />
              <NavItem to="/chat" label="Chat" />
              <NavItem to="/account" label="Account" />
              <button
                type="button"
                className="rounded-full border border-border-subtle px-3 py-1.5 text-sm text-text-secondary"
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </button>
            </nav>
          </div>
        </header>
      ) : null}
      <main className={userId ? 'mx-auto max-w-6xl px-4 py-6' : ''}>
        {isLoading ? (
          <div className="py-10 text-sm text-text-secondary">Loading...</div>
        ) : (
          <Outlet />
        )}
      </main>
      <Toaster />
    </div>
  );
}
