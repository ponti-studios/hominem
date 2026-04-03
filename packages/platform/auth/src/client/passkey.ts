import { useCallback, useMemo, useState } from 'react';

import { useAuth } from './provider';

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function encodeBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function mapCreationOptions(input: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const user = input.user as Record<string, unknown>;
  const excludeCredentials = Array.isArray(input.excludeCredentials)
    ? (input.excludeCredentials as Array<Record<string, unknown>>).map((credential) => ({
        ...credential,
        id: decodeBase64Url(String(credential.id)),
      }))
    : undefined;

  return {
    ...input,
    challenge: decodeBase64Url(String(input.challenge)),
    user: {
      ...user,
      id: decodeBase64Url(String(user.id)),
    },
    ...(excludeCredentials ? { excludeCredentials } : {}),
  } as PublicKeyCredentialCreationOptions;
}

function mapRequestOptions(input: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  const allowCredentials = Array.isArray(input.allowCredentials)
    ? (input.allowCredentials as Array<Record<string, unknown>>).map((credential) => ({
        ...credential,
        id: decodeBase64Url(String(credential.id)),
      }))
    : undefined;

  return {
    ...input,
    challenge: decodeBase64Url(String(input.challenge)),
    ...(allowCredentials ? { allowCredentials } : {}),
  } as PublicKeyCredentialRequestOptions;
}

function serializeRegistration(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      attestationObject: encodeBase64Url(response.attestationObject),
    },
  };
}

function serializeAuthentication(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
      authenticatorData: encodeBase64Url(response.authenticatorData),
      signature: encodeBase64Url(response.signature),
      userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null,
    },
  };
}

export function usePasskeyAuth(input?: { redirectTo?: string }) {
  const { apiBaseUrl, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const isSupported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;

  const authenticate = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Passkeys are not supported in this browser.');
    }
    setError(null);
    const optionsResponse = await fetch(new URL('/api/auth/passkey/auth/options', apiBaseUrl).toString(), {
      method: 'POST',
      credentials: 'include',
    });
    if (!optionsResponse.ok) {
      const message = 'Passkey sign-in failed.';
      setError(message);
      throw new Error(message);
    }
    const options = mapRequestOptions((await optionsResponse.json()) as Record<string, unknown>);
    const credential = (await navigator.credentials.get({ publicKey: options })) as PublicKeyCredential | null;
    if (!credential) {
      throw new Error('Passkey sign-in was cancelled.');
    }
    const verifyResponse = await fetch(new URL('/api/auth/passkey/auth/verify', apiBaseUrl).toString(), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: serializeAuthentication(credential) }),
    });
    if (!verifyResponse.ok) {
      const message = 'Passkey sign-in failed.';
      setError(message);
      throw new Error(message);
    }
    await refresh();
    if (input?.redirectTo) {
      window.location.assign(input.redirectTo);
    }
  }, [apiBaseUrl, input?.redirectTo, isSupported, refresh]);

  const register = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Passkeys are not supported in this browser.');
    }
    setError(null);
    const optionsResponse = await fetch(new URL('/api/auth/passkey/register/options', apiBaseUrl).toString(), {
      method: 'POST',
      credentials: 'include',
    });
    if (!optionsResponse.ok) {
      const message = 'Passkey registration failed.';
      setError(message);
      throw new Error(message);
    }
    const options = mapCreationOptions((await optionsResponse.json()) as Record<string, unknown>);
    const credential = (await navigator.credentials.create({ publicKey: options })) as PublicKeyCredential | null;
    if (!credential) {
      throw new Error('Passkey registration was cancelled.');
    }
    const verifyResponse = await fetch(new URL('/api/auth/passkey/register/verify', apiBaseUrl).toString(), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: serializeRegistration(credential) }),
    });
    if (!verifyResponse.ok) {
      const message = 'Passkey registration failed.';
      setError(message);
      throw new Error(message);
    }
    await refresh();
  }, [apiBaseUrl, isSupported, refresh]);

  const deletePasskey = useCallback(async (id: string) => {
    setError(null);
    const response = await fetch(new URL('/api/auth/passkey/delete', apiBaseUrl).toString(), {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      const message = 'Passkey deletion failed.';
      setError(message);
      throw new Error(message);
    }
    await refresh();
  }, [apiBaseUrl, refresh]);

  return useMemo(
    () => ({ authenticate, register, deletePasskey, error, isSupported }),
    [authenticate, deletePasskey, error, isSupported, register],
  );
}
