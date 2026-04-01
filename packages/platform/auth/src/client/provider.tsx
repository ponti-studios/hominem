import {
  useRef,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { AuthContext } from './context'
import type { AppAuthStatus, AuthClient, AuthConfig, AuthContextType, Session, User } from '../types'

// ─── Internal Types ───────────────────────────────────────────────────────────

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED'

interface SessionResponse {
  isAuthenticated: boolean
  user: User | null
  auth?: {
    sub: string
    sid: string
    scope: string[]
    role: 'user' | 'admin'
    amr: string[]
    authTime: number
  } | null
  accessToken?: string | null
  expiresIn?: number | null
}

interface ClientAuthState {
  error: Error | null
  isLoading: boolean
  session: Session | null
  status: AppAuthStatus
  user: User | null
}

export interface AuthProviderProps {
  children: ReactNode
  config: AuthConfig
  onAuthEvent?: (event: AuthEvent) => void
  /** SSR-hydrated user (skips initial session fetch when present). */
  initialUser?: User | null
  /** SSR-hydrated session token envelope. */
  initialSession?: Session | null
}

// ─── WebAuthn Helpers ─────────────────────────────────────────────────────────

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): ArrayBuffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(normalized + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

interface RawPasskeyRequestOptions {
  challenge: string
  timeout?: number
  rpId?: string
  allowCredentials?: Array<{ type: string; id: string; transports?: string[] }>
  userVerification?: UserVerificationRequirement
}

interface RawPasskeyCreationOptions {
  challenge: string
  rp: { name: string; id: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: Array<{ type: string; alg: number }>
  timeout?: number
  excludeCredentials?: Array<{ id: string; type: string; transports?: string[] }>
  attestation?: string
  extensions?: Record<string, unknown>
}

function normalizeRequestOptions(raw: RawPasskeyRequestOptions): PublicKeyCredentialRequestOptions {
  const result: PublicKeyCredentialRequestOptions = {
    challenge: fromBase64Url(raw.challenge),
  }
  if (raw.timeout !== undefined) result.timeout = raw.timeout
  if (raw.rpId) result.rpId = raw.rpId
  if (raw.userVerification) result.userVerification = raw.userVerification
  if (raw.allowCredentials) {
    result.allowCredentials = raw.allowCredentials.map((c) => ({
      type: c.type as PublicKeyCredentialType,
      id: fromBase64Url(c.id),
      ...(c.transports ? { transports: c.transports as AuthenticatorTransport[] } : {}),
    }))
  }
  return result
}

function normalizeCreationOptions(raw: RawPasskeyCreationOptions): PublicKeyCredentialCreationOptions {
  const result: Record<string, unknown> = {
    challenge: fromBase64Url(raw.challenge),
    rp: raw.rp,
    user: {
      id: fromBase64Url(raw.user.id),
      name: raw.user.name,
      displayName: raw.user.displayName,
    },
    pubKeyCredParams: raw.pubKeyCredParams as PublicKeyCredentialParameters[],
  }
  if (raw.timeout !== undefined) result.timeout = raw.timeout
  if (raw.excludeCredentials) {
    result.excludeCredentials = raw.excludeCredentials.map((c) => ({
      id: fromBase64Url(c.id),
      type: c.type as PublicKeyCredentialType,
      ...(c.transports ? { transports: c.transports as AuthenticatorTransport[] } : {}),
    }))
  }
  if (raw.attestation !== undefined) result.attestation = raw.attestation
  if (raw.extensions !== undefined) result.extensions = raw.extensions
  return result as unknown as PublicKeyCredentialCreationOptions
}

function serializeAssertion(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: 'public-key' as const,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
    },
  }
}

// ─── Session Helpers ──────────────────────────────────────────────────────────

function getUrl(apiBaseUrl: string, path: string) {
  return new URL(path, apiBaseUrl).toString()
}

function toSession(accessToken?: string | null, expiresIn?: number | null): Session | null {
  if (!accessToken) return null
  const ttl = typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 600
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ttl,
    expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
  }
}

async function fetchSession(apiBaseUrl: string): Promise<SessionResponse> {
  const res = await fetch(getUrl(apiBaseUrl, '/api/auth/session'), {
    method: 'GET',
    credentials: 'include',
  })
  if (res.ok) return (await res.json()) as SessionResponse
  return { isAuthenticated: false, user: null, accessToken: null }
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────

export function AuthProvider({
  children,
  config,
  onAuthEvent,
  initialUser = null,
  initialSession = null,
}: AuthProviderProps) {
  const hasInitialAuth = Boolean(initialUser)
  const previousTokenRef = useRef<string | null>(initialSession?.access_token ?? null)

  const [state, setState] = useState<ClientAuthState>(() => ({
    error: null,
    isLoading: !hasInitialAuth,
    session: initialSession,
    status: hasInitialAuth ? 'signed_in' : 'booting',
    user: initialUser,
  }))

  const refreshAuth = useCallback(async () => {
    const payload = await fetchSession(config.apiBaseUrl)
    setState((current) => {
      const nextSession = toSession(payload.accessToken, payload.expiresIn)
      const session = payload.isAuthenticated && payload.user
        ? nextSession ?? current.session
        : null
      return {
        error: null,
        isLoading: false,
        session,
        status: payload.user ? 'signed_in' : 'signed_out',
        user: payload.user ?? null,
      }
    })
    return payload
  }, [config.apiBaseUrl])

  // Boot: fetch session once on mount unless SSR-hydrated
  useEffect(() => {
    if (hasInitialAuth) return
    void refreshAuth()
  }, [hasInitialAuth, refreshAuth])

  // Auto-refresh: refresh token before it expires
  useEffect(() => {
    if (state.status !== 'signed_in') return
    const expiresIn = state.session?.expires_in ?? 600
    const base = Math.max((expiresIn - 60) * 1000, 5 * 60 * 1000)
    const interval = base + Math.random() * 0.3 * base
    const id = setInterval(() => void refreshAuth(), interval)
    return () => clearInterval(id)
  }, [state.session, state.status, refreshAuth])

  // Emit TOKEN_REFRESHED when access_token changes
  useEffect(() => {
    const current = state.session?.access_token ?? null
    if (!current) { previousTokenRef.current = null; return }
    if (previousTokenRef.current === null) { previousTokenRef.current = current; return }
    if (previousTokenRef.current === current) return
    previousTokenRef.current = current
    onAuthEvent?.('TOKEN_REFRESHED')
  }, [state.session, onAuthEvent])

  // ─── Actions ────────────────────────────────────────────────────────────────

  const signIn = useCallback(async () => {
    window.location.href = '/auth'
  }, [])

  const signInWithEmail = useCallback(async () => {
    window.location.href = '/auth'
  }, [])

  const signInWithPasskey = useCallback(async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      throw new Error('Passkeys are not supported in this environment.')
    }

    const optRes = await fetch(getUrl(config.apiBaseUrl, '/api/auth/passkey/auth/options'), {
      method: 'POST',
      credentials: 'include',
    })
    if (!optRes.ok) throw new Error('Failed to get passkey authentication options.')

    const optPayload = (await optRes.json()) as { options?: RawPasskeyRequestOptions } | RawPasskeyRequestOptions
    const rawOptions = (optPayload as { options?: RawPasskeyRequestOptions }).options ?? (optPayload as RawPasskeyRequestOptions)
    if (typeof rawOptions.challenge !== 'string') throw new Error('Invalid passkey options.')

    const credential = (await navigator.credentials.get({
      publicKey: normalizeRequestOptions(rawOptions),
    })) as PublicKeyCredential | null
    if (!credential) throw new Error('Passkey authentication was cancelled.')

    const verRes = await fetch(getUrl(config.apiBaseUrl, '/api/auth/passkey/auth/verify'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: serializeAssertion(credential) }),
    })
    if (!verRes.ok) throw new Error('Passkey sign-in failed.')

    await refreshAuth()
  }, [config.apiBaseUrl, refreshAuth])

  const addPasskey = useCallback(async (name?: string) => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      throw new Error('Passkeys are not supported in this environment.')
    }

    const optRes = await fetch(getUrl(config.apiBaseUrl, '/api/auth/passkey/register/options'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name ?? 'Default Device' }),
    })
    if (!optRes.ok) throw new Error('Failed to get passkey registration options.')

    const optPayload = (await optRes.json()) as { options?: RawPasskeyCreationOptions } | RawPasskeyCreationOptions
    const rawOptions = (optPayload as { options?: RawPasskeyCreationOptions }).options ?? (optPayload as RawPasskeyCreationOptions)
    if (typeof rawOptions.challenge !== 'string') throw new Error('Invalid passkey registration options.')

    const credential = (await navigator.credentials.create({
      publicKey: normalizeCreationOptions(rawOptions),
    })) as PublicKeyCredential | null
    if (!credential) throw new Error('Passkey registration was cancelled.')

    const verRes = await fetch(getUrl(config.apiBaseUrl, '/api/auth/passkey/register/verify'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        response: serializeAssertion(credential),
        name: name ?? 'Default Device',
      }),
    })
    if (!verRes.ok) throw new Error('Passkey registration failed.')
  }, [config.apiBaseUrl])

  const requireStepUp = useCallback(async (action: string) => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      throw new Error('Passkeys are not supported in this environment.')
    }

    const optRes = await fetch(getUrl(config.apiBaseUrl, '/api/auth/passkey/auth/options'), {
      method: 'POST',
      credentials: 'include',
    })
    if (!optRes.ok) throw new Error('Failed to get passkey options for step-up.')

    const optPayload = (await optRes.json()) as { options?: RawPasskeyRequestOptions } | RawPasskeyRequestOptions
    const rawOptions = (optPayload as { options?: RawPasskeyRequestOptions }).options ?? (optPayload as RawPasskeyRequestOptions)
    if (typeof rawOptions.challenge !== 'string') throw new Error('Invalid passkey options.')

    const credential = (await navigator.credentials.get({
      publicKey: normalizeRequestOptions(rawOptions),
    })) as PublicKeyCredential | null
    if (!credential) throw new Error('Passkey step-up was cancelled.')

    const verRes = await fetch(getUrl(config.apiBaseUrl, '/api/auth/passkey/auth/verify'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: serializeAssertion(credential), action }),
    })
    if (!verRes.ok) throw new Error('Passkey step-up verification failed.')
  }, [config.apiBaseUrl])

  const linkGoogle = useCallback(async () => {
    throw new Error('OAuth account linking is disabled.')
  }, [])

  const unlinkGoogle = useCallback(async () => {
    throw new Error('OAuth account unlinking is disabled.')
  }, [])

  const signOut = useCallback(async () => {
    setState((s) => ({ ...s, error: null, isLoading: true, status: 'signing_out' }))
    try {
      const res = await fetch(getUrl(config.apiBaseUrl, '/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Sign out failed. Please try again.')
      setState({ error: null, isLoading: false, session: null, status: 'signed_out', user: null })
      onAuthEvent?.('SIGNED_OUT')
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sign out failed.')
      setState((s) => ({
        ...s,
        error,
        isLoading: false,
        status: s.user ? 'signed_in' : 'signed_out',
      }))
      throw error
    }
  }, [config.apiBaseUrl, onAuthEvent])

  const getSession = useCallback(async (): Promise<Session | null> => {
    if (state.session) return state.session
    const payload = await refreshAuth()
    return toSession(payload.accessToken, payload.expiresIn)
  }, [state.session, refreshAuth])

  const authClient = useMemo<AuthClient>(() => ({
    auth: {
      signInWithOAuth: async () => ({
        error: new Error('OAuth sign-in is disabled. Use email OTP or passkey.'),
      }),
      signOut: async () => {
        try {
          await signOut()
          return { error: null }
        } catch (err) {
          return { error: err instanceof Error ? err : new Error('Sign out failed.') }
        }
      },
      getSession: async () => {
        try {
          return { data: { session: await getSession() }, error: null }
        } catch (err) {
          return {
            data: { session: null },
            error: err instanceof Error ? err : new Error('Failed to get session.'),
          }
        }
      },
    },
  }), [signOut, getSession])

  const value = useMemo<AuthContextType>(
    () => ({
      user: state.user,
      session: state.session,
      isLoading: state.isLoading,
      isAuthenticated: state.status === 'signed_in',
      signIn,
      signInWithEmail,
      signInWithPasskey,
      addPasskey,
      linkGoogle,
      unlinkGoogle,
      signOut,
      getSession,
      requireStepUp,
      logout: signOut,
      authClient,
      userId: state.user?.id,
    }),
    [
      state,
      signIn,
      signInWithEmail,
      signInWithPasskey,
      addPasskey,
      linkGoogle,
      unlinkGoogle,
      signOut,
      getSession,
      requireStepUp,
      authClient,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
