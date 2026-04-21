import { useAuthClient } from '@hakumi/auth/client/provider';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function useSignOut() {
  const authClient = useAuthClient();
  const navigate = useNavigate();

  return useCallback(async () => {
    const result = await authClient.signOut();
    if (result.error) {
      throw new Error(result.error.message ?? 'Unable to sign out.');
    }
    navigate('/auth');
  }, [authClient, navigate]);
}
