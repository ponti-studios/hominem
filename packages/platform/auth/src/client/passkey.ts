import { useCallback, useEffect, useState } from 'react'
import { STEP_UP_ACTIONS } from '../shared/step-up-actions'

// ─── WebAuthn Helpers ─────────────────────────────────────────────────────────

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

interface RawRequestOptions {
  challenge: string
  timeout?: number
  rpId?: string
  allowCredentials?: Array<{ type: string; id: string; transports?: string[] }>
  userVerification?: UserVerificationRequirement
}

interface RawCreationOptions {
  challenge: string
  timeout?: number
  rp: { id: string; name: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: Array<{ type: string; alg: number }>
  excludeCredentials?: Array<{ type: string; id: string; transports?: string[] }>
  authenticatorSelection?: AuthenticatorSelectionCriteria
  attestation?: AttestationConveyancePreference
}

function normalizeRequestOptions(raw: RawRequestOptions): PublicKeyCredentialRequestOptions {
  const result: PublicKeyCredentialRequestOptions = { challenge: decodeBase64Url(raw.challenge) }
  if (raw.timeout !== undefined) result.timeout = raw.timeout
  if (raw.rpId !== undefined) result.rpId = raw.rpId
  if (raw.userVerification !== undefined) result.userVerification = raw.userVerification
  if (raw.allowCredentials !== undefined) {
    result.allowCredentials = raw.allowCredentials.map((c) => {
      const desc: PublicKeyCredentialDescriptor = {
        type: c.type as PublicKeyCredentialType,
        id: decodeBase64Url(c.id),
      }
      if (c.transports) desc.transports = c.transports as AuthenticatorTransport[]
      return desc
    })
  }
  return result
}

function normalizeCreationOptions(raw: RawCreationOptions): PublicKeyCredentialCreationOptions {
  const result: PublicKeyCredentialCreationOptions = {
    challenge: decodeBase64Url(raw.challenge),
    rp: raw.rp,
    user: {
      id: decodeBase64Url(raw.user.id),
      name: raw.user.name,
      displayName: raw.user.displayName,
    },
    pubKeyCredParams: raw.pubKeyCredParams.map((p) => ({
      type: p.type as PublicKeyCredentialType,
      alg: p.alg,
    })),
  }
  if (raw.timeout !== undefined) result.timeout = raw.timeout
  if (raw.attestation !== undefined) result.attestation = raw.attestation
  if (raw.authenticatorSelection !== undefined) result.authenticatorSelection = raw.authenticatorSelection
  if (raw.excludeCredentials !== undefined) {
    result.excludeCredentials = raw.excludeCredentials.map((c) => {
      const desc: PublicKeyCredentialDescriptor = {
        type: c.type as PublicKeyCredentialType,
        id: decodeBase64Url(c.id),
      }
      if (c.transports) desc.transports = c.transports as AuthenticatorTransport[]
      return desc
    })
  }
  return result
}

function serializeCredential(credential: PublicKeyCredential, isAssertion: true): object
function serializeCredential(credential: PublicKeyCredential, isAssertion: false): object
function serializeCredential(credential: PublicKeyCredential, isAssertion: boolean): object {
  if (isAssertion) {
    const response = credential.response as AuthenticatorAssertionResponse
    return {
      id: credential.id,
      rawId: arrayBufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
        authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
        signature: arrayBufferToBase64Url(response.signature),
        userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : null,
      },
    }
  }
  const response = credential.response as AuthenticatorAttestationResponse
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      transports: response.getTransports ? response.getTransports() : [],
    },
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function getDefaultApiUrl(): string {
  // Works in Vite, Bun, Node — avoids import.meta (not supported in Hermes/RN)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = typeof process !== 'undefined' ? (process as any) : undefined
  if (proc?.env?.VITE_PUBLIC_API_URL) return proc.env.VITE_PUBLIC_API_URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  if (g.__VITE_PUBLIC_API_URL__) return g.__VITE_PUBLIC_API_URL__
  return ''
}

export interface UsePasskeyAuthOptions {
  /** API base URL. Defaults to VITE_PUBLIC_API_URL env var. */
  apiBaseUrl?: string
  /** Where to redirect after successful sign-in. */
  redirectTo?: string
}

export function usePasskeyAuth(options: UsePasskeyAuthOptions = {}) {
  const apiBaseUrl = options.apiBaseUrl ?? getDefaultApiUrl()
  const { redirectTo } = options
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(typeof navigator !== 'undefined' && !!navigator.credentials)
  }, [])

  function getUrl(path: string) {
    return new URL(path, apiBaseUrl).toString()
  }

  // ─── Authenticate (sign-in) ────────────────────────────────────────────────

  const authenticate = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const optRes = await fetch(getUrl('/api/auth/passkey/auth/options'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!optRes.ok) {
        const err = await optRes.json() as { message?: string }
        throw new Error(err.message ?? 'Failed to get passkey options.')
      }

      const optPayload = await optRes.json() as { options?: RawRequestOptions } | RawRequestOptions
      const rawOptions = (optPayload as { options?: RawRequestOptions }).options
        ?? (optPayload as RawRequestOptions)

      const credential = (await navigator.credentials.get({
        publicKey: normalizeRequestOptions(rawOptions),
      })) as PublicKeyCredential | null
      if (!credential) throw new Error('No passkey credential provided.')

      const verRes = await fetch(getUrl('/api/auth/passkey/auth/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response: serializeCredential(credential, true) }),
      })
      if (!verRes.ok) {
        const err = await verRes.json() as { message?: string }
        throw new Error(err.message ?? 'Passkey verification failed.')
      }

      if (redirectTo) window.location.href = redirectTo
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey authentication failed.')
      return false
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, redirectTo])

  // ─── Step-Up ───────────────────────────────────────────────────────────────

  const requireStepUp = useCallback(async (action: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const optRes = await fetch(getUrl('/api/auth/passkey/auth/options'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!optRes.ok) {
        const err = await optRes.json() as { message?: string }
        throw new Error(err.message ?? 'Failed to get passkey options.')
      }

      const optPayload = await optRes.json() as { options?: RawRequestOptions } | RawRequestOptions
      const rawOptions = (optPayload as { options?: RawRequestOptions }).options
        ?? (optPayload as RawRequestOptions)

      const credential = (await navigator.credentials.get({
        publicKey: normalizeRequestOptions(rawOptions),
      })) as PublicKeyCredential | null
      if (!credential) throw new Error('No passkey credential provided.')

      const verRes = await fetch(getUrl('/api/auth/passkey/auth/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, response: serializeCredential(credential, true) }),
      })
      if (!verRes.ok) {
        const err = await verRes.json() as { message?: string }
        throw new Error(err.message ?? 'Passkey step-up verification failed.')
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey step-up failed.')
      return false
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl])

  // ─── Register ──────────────────────────────────────────────────────────────

  const register = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const stepUpOk = await requireStepUp(STEP_UP_ACTIONS.PASSKEY_REGISTER)
      if (!stepUpOk) return false

      const optRes = await fetch(getUrl('/api/auth/passkey/register/options'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (!optRes.ok) {
        const err = await optRes.json() as { message?: string }
        throw new Error(err.message ?? 'Failed to get registration options.')
      }

      const optPayload = await optRes.json() as { options?: RawCreationOptions } | RawCreationOptions
      const rawOptions = (optPayload as { options?: RawCreationOptions }).options
        ?? (optPayload as RawCreationOptions)

      const credential = (await navigator.credentials.create({
        publicKey: normalizeCreationOptions(rawOptions),
      })) as PublicKeyCredential | null
      if (!credential) throw new Error('No passkey credential created.')

      const verRes = await fetch(getUrl('/api/auth/passkey/register/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response: serializeCredential(credential, false) }),
      })
      if (!verRes.ok) {
        const err = await verRes.json() as { message?: string }
        throw new Error(err.message ?? 'Passkey registration failed.')
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey registration failed.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [requireStepUp])

  // ─── Delete ────────────────────────────────────────────────────────────────

  const deletePasskey = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const stepUpOk = await requireStepUp(STEP_UP_ACTIONS.PASSKEY_DELETE)
      if (!stepUpOk) return false

      const res = await fetch(getUrl('/api/auth/passkey/delete'), {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const err = await res.json() as { message?: string }
        throw new Error(err.message ?? 'Failed to delete passkey.')
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete passkey.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [requireStepUp])

  return { authenticate, register, requireStepUp, deletePasskey, isLoading, error, isSupported }
}
