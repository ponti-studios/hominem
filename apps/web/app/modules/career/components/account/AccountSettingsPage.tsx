import { LogOut, Mail } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { DeleteButton, DetailSection, PageHeader } from '~/components/design';
import { Container } from '~/components/design/container';
import { IconField } from '~/components/design/forms';
import { Button } from '~/components/ui/button';
import type {
  AccountActionResult,
  AccountSettingsLoaderData,
} from '~/modules/career/lib/account/types';

export function AccountSettingsPage({ loaderData }: { loaderData: AccountSettingsLoaderData }) {
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { user, currentProfile } = loaderData;

  const submitAccountAction = async <TData,>(
    formData: FormData,
  ): Promise<AccountActionResult<TData>> => {
    const response = await fetch('/account', {
      method: 'POST',
      body: formData,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');

    if (!response.ok) {
      const failure: Partial<AccountActionResult<TData>> = isJson
        ? await response.json()
        : { error: await response.text() };
      throw new Error(failure.error || failure.message || 'Request failed');
    }

    const result: AccountActionResult<TData> = isJson
      ? await response.json()
      : { success: true, error: undefined };

    return result;
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      // Full-page hop through the API's logout so the user lands on its signed-out sign-in.
      const logoutUrl = new URL('/logout', import.meta.env.VITE_PUBLIC_API_URL);
      logoutUrl.searchParams.set('next', window.location.origin);
      window.location.assign(logoutUrl.toString());
    } catch {
      // sign-out failed, just stay put on the account page
      setIsSigningOut(false);
    }
  };

  const handleDeleteProfile = async () => {
    const formData = new FormData();
    formData.append('action', 'delete');
    formData.append('profileId', currentProfile.id);

    await submitAccountAction(formData);
    navigate('/career/work');
  };

  return (
    <Container size="sm">
      <PageHeader eyebrow="Career · Account" title="Account" />

      <DetailSection title="Identity">
        <IconField
          label="Email"
          icon={<Mail className="size-4" aria-hidden />}
          name="email"
          value={user.email ?? ''}
          disabled
          readOnly
        />
      </DetailSection>

      <DetailSection title="Danger zone">
        <div className="flex flex-col gap-3">
          <DeleteButton itemName="profile" label="Delete profile" onConfirm={handleDeleteProfile} />
          <div>
            <Button type="button" onClick={handleSignOut} disabled={isSigningOut} className="gap-2">
              <LogOut className="size-4" />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </div>
      </DetailSection>
    </Container>
  );
}
