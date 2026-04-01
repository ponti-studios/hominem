// Client-side barrel for @hominem/auth.
// Safe for browser bundles — contains no Node.js or DB imports.

export { AuthContext, useAuth, useAuthContext, useSafeAuth, useProtectedRoute } from './context'
export type { AuthContextType } from './context'

export { AuthProvider } from './provider'
export type { AuthProviderProps } from './provider'

export { usePasskeyAuth } from './passkey'
export type { UsePasskeyAuthOptions } from './passkey'
