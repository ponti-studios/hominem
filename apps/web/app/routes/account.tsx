import { Container } from '@hominem/ui';
import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@hominem/ui/card';
import { data, redirect } from 'react-router';

import { useSignOut } from '~/lib/hooks/use-sign-out';
import { getServerSession } from '~/lib/auth.server';
import type { Route } from './+types/account';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await getServerSession(request);
  if (!user) {
    throw redirect('/auth', { headers });
  }

  return data({ userId: user.id }, { headers });
}

export default function AccountPage() {
  const signOut = useSignOut();

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
