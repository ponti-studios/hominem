import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@hominem/ui/card';

import { useSignOut } from '~/lib/hooks/use-sign-out';

export default function AccountPage() {
  const signOut = useSignOut();

  return (
    <main className="container mx-auto w-full px-4 py-8 sm:px-6">
      <header className="mb-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Profile</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage your account and active session.</p>
        </div>
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
              <Button variant="outline" onClick={() => void signOut()}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
