import { createContext, useContext } from 'react'
import type { AuthContextType } from '../types'

/**
 * The React context that holds auth state and actions.
 * Always use `useAuth()` or `useSafeAuth()` — never access this directly.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Hook to access auth state and functions. Throws if used outside AuthProvider.
 * Use in any protected component that requires auth.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Alias for `useAuth`. Preserved for backwards compatibility.
 */
export const useAuthContext = useAuth

/**
 * Safe variant that returns null instead of throwing.
 * Use in layout components or SSR contexts where auth may not be available.
 */
export function useSafeAuth(): AuthContextType | null {
  return useContext(AuthContext) ?? null
}

/**
 * Returns the current auth/loading state without the methods.
 * Useful for components that only read auth state.
 */
export function useProtectedRoute(): { isAuthenticated: boolean; isLoading: boolean } {
  const { isAuthenticated, isLoading } = useAuth()
  return { isAuthenticated, isLoading }
}

export type { AuthContextType }
