import { useAuthClient } from '@hominem/auth/client/provider';
import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export default function AccountPage() {
  const navigate = useNavigate();
  const authClient = useAuthClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await authClient.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="py-2">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Account</h1>
        </div>

        <Card>
          <CardContent>
            <div className="flex items-start">
              <div className="flex items-center space-x-3">
                <div>
                  <h3 className="text-base font-medium">Account Settings</h3>
                  <p className="text-sm text-muted-foreground">Manage your account preferences</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="border-t border-border pt-6 flex justify-end">
          <Button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            variant="default"
            className="w-full sm:w-auto"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </div>
      </div>
    </div>
  );
}
