import { useAuth } from '@hominem/auth';
import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@hominem/ui/card';
import { Container } from '@hominem/ui/components/layout';
import { useEffect } from 'react';
import { Navigate } from 'react-router';

export default function AccountPage() {
  const { userId, isLoading, logout } = useAuth();

  useEffect(() => {
    // No-op: legacy Twitter connection side effects were removed with the auth rewrite.
  }, []);

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
              <Button variant="outline" onClick={() => logout()}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
