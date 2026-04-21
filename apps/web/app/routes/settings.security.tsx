import { usePasskeys } from '@hakumi/auth/client/passkey';
import { Container, PasskeyManagement } from '@hakumi/ui';
import { useCallback } from 'react';
import { redirect } from 'react-router';

import { getServerSession } from '~/lib/auth.server';

export async function loader({ request }: { request: Request }) {
  const { user, headers } = await getServerSession(request);
  if (!user) {
    return redirect('/auth', { headers });
  }
  return null;
}

export default function SecuritySettingsPage() {
  const { data: passkeys, isLoading, error, deletePasskey, register } = usePasskeys();
  const handleAdd = useCallback(async () => {
    try {
      await register();
      return true;
    } catch {
      return false;
    }
  }, [register]);
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deletePasskey(id);
        return true;
      } catch {
        return false;
      }
    },
    [deletePasskey],
  );

  return (
    <Container maxWidth="sm" className="py-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-foreground">Security</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage sign-in methods and authentication settings.
        </p>
      </header>
      <PasskeyManagement
        passkeys={
          passkeys?.map((passkey) => ({
            id: passkey.id,
            ...(passkey.name ? { name: passkey.name } : {}),
          })) ?? undefined
        }
        isLoading={isLoading}
        error={error?.message ?? null}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />
    </Container>
  );
}
