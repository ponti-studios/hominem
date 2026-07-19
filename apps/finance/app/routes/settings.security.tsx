import { usePasskeys } from '@hominem/auth/client/passkey';
import { useCallback } from 'react';
import { redirect } from 'react-router';

import { PasskeyManagement, SectionIntro } from '~/components/patterns';
import { getServerAuth } from '~/lib/auth.server';

export async function loader({ request }: { request: Request }) {
  const { user, headers } = await getServerAuth(request);
  if (!user) {
    return redirect('/auth', { headers });
  }
  return null;
}

export default function SecuritySettingsPage() {
  const {
    data: passkeys,
    isLoading,
    error,
    register,
    deletePasskey,
    authError,
  } = usePasskeys({
    enabled: true,
  });

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
    <div className="mx-auto w-full max-w-xl space-y-8">
      <SectionIntro
        title="Security"
        description="Manage sign-in methods and authentication settings."
      />
      <PasskeyManagement
        passkeys={passkeys.map((p) => ({
          id: p.id,
          ...(p.name ? { name: p.name } : {}),
          ...(p.createdAt
            ? {
                createdAt:
                  typeof p.createdAt === 'string' ? p.createdAt : p.createdAt.toISOString(),
              }
            : {}),
        }))}
        isLoading={isLoading}
        error={authError ?? error?.message ?? null}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />
    </div>
  );
}
