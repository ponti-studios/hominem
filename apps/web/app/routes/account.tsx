import { useAuthClient, useSession } from '@hominem/auth/client';
import { Container } from '@hominem/ui';
import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@hominem/ui/card';
import { useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router';

export default function AccountPage() {
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!userId) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Container maxWidth="sm" className="py-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your account</p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Manage your session.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-border/30 p-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">Sign Out</h3>
                <p className="text-sm text-text-secondary">End your current session.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  void signOut();
                }}
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
