import { usePasskeys } from '@hominem/auth/client/passkey';
import { PasskeyManagement } from '@hominem/ui';
import { useCallback } from 'react';
import { data } from 'react-router';

import { SettingsPageLayout } from '~/components/settings-page-layout';
import { createServerApiClient } from '~/lib/api.server';

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
  try {
    const client = createServerApiClient(request);
    const payload = await client.api.auth.passkey['list-user-passkeys']
      .$get()
      .then((res) => res.json())
      .catch(() => null);
    return data({
      passkeys: normalizePasskeys(payload),
    });
  } catch {
    return data({ passkeys: [] });
  }
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
    <SettingsPageLayout
      currentTab="security"
      title="Security"
      description="Manage sign-in methods and authentication settings."
    >
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
    </SettingsPageLayout>
  );
}
