import { Button } from '@hominem/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@hominem/ui/card';

import { SettingsPageLayout } from '~/components/settings-page-layout';
import { useSignOut } from '~/lib/hooks/use-sign-out';

export default function AccountPage() {
  const signOut = useSignOut();

  return (
    <SettingsPageLayout
      currentTab="account"
      title="Profile"
      description="Manage your account and active session."
    >
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
    </SettingsPageLayout>
  );
}
