import { usePasskeys } from '@hominem/auth/client/passkey';
import { Container, PasskeyManagement } from '@hominem/ui';
import { useCallback } from 'react';
import { data, redirect } from 'react-router';

import { getServerSession } from '~/lib/auth.server';
import { serverEnv } from '~/lib/env.server';

import type { Route } from './+types/settings.security';

type LoaderPasskey = {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
};

function normalizePasskeys(payload: unknown): LoaderPasskey[] {
  if (Array.isArray(payload)) {
    return payload as LoaderPasskey[];
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    const data = (payload as { data?: unknown }).data;
    return Array.isArray(data) ? (data as LoaderPasskey[]) : [];
  }

  return [];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getServerSession(request);
  if (!user) {
    return redirect('/auth');
  }

  const cookie = request.headers.get('cookie');
  const headers = cookie ? { cookie } : undefined;
  const response = await fetch(
    new URL('/api/auth/passkey/list-user-passkeys', serverEnv.VITE_PUBLIC_API_URL).toString(),
    { headers },
  );

  const payload = response.ok ? await response.json().catch(() => null) : null;

  return data({
    passkeys: normalizePasskeys(payload),
  });
}

export default function SecuritySettingsPage({ loaderData }: Route.ComponentProps) {
  const { passkeys: initialPasskeys } = loaderData;
  const {
    data: passkeys,
    isLoading,
    error,
    deletePasskey,
    register,
  } = usePasskeys({
    enabled: false,
    initialPasskeys,
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
