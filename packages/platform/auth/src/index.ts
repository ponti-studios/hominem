/**
 * @hominem/auth — Unified authentication package for web, mobile, and CLI.
 *
 * ## Import Patterns
 *
 * ### Client / Browser (web & mobile)
 * ```ts
 * import { AuthProvider, useAuth, useSafeAuth } from '@hominem/auth'
 * import { usePasskeyAuth } from '@hominem/auth'
 * ```
 *
 * ### Server-only (Hono middleware, Remix loaders)
 * ```ts
 * import { getServerAuth, UserAuthService, grantStepUp } from '@hominem/auth/server'
 * ```
 *
 * ### Shared contracts (types, copy, redirect policy)
 * ```ts
 * import type { User, Session, AppAuthStatus } from '@hominem/auth'
 * import { AUTH_COPY, NOTES_AUTH_CONFIG, CHAT_AUTH_CONFIG } from '@hominem/auth'
 * import { resolveAuthRedirect } from '@hominem/auth'
 * import { STEP_UP_ACTIONS } from '@hominem/auth/step-up-actions'
 * ```
 */

import {
  AuthContext,
  useAuth as useAuthImpl,
  useAuthContext as useAuthContextImpl,
  useProtectedRoute,
  useSafeAuth,
} from './client/context'

// ─── Client ───────────────────────────────────────────────────────────────────
export { AuthContext }
export { useAuthImpl as useAuth, useAuthContextImpl as useAuthContext, useSafeAuth, useProtectedRoute }
export type { AuthContextType } from './client/context'
export { AuthProvider } from './client/provider'
export type { AuthProviderProps } from './client/provider'
export { usePasskeyAuth } from './client/passkey'
export type { UsePasskeyAuthOptions } from './client/passkey'

// ─── Types ────────────────────────────────────────────────────────────────────
export * from './types'

// ─── Shared (browser-safe) ────────────────────────────────────────────────────
export * from './shared/ux-contract'
export * from './shared/redirect-policy'
export * from './shared/step-up-actions'
export * from './shared/error-contract'
