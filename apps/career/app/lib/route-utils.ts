/**
 * Utility functions for React Router V7 routes to reduce code duplication
 */

// @ts-nocheck
/* eslint-disable */

import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { getAuthenticatedUser, requireAuth, type User } from './auth.server'
import { createClient } from './supabase/server'
import { shouldUseMockData } from './utils/mock-data'

// Standard API response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface AuthenticatedContext {
  user: User
  request: Request
  supabase: ReturnType<typeof createClient>['supabase']
}

/**
 * Higher-order function for authenticated loaders
 * Handles the common pattern of getting user and checking auth
 */
export async function withAuth<T>(
  request: Request,
  callback: (context: AuthenticatedContext) => Promise<T>
): Promise<T> {
  const user = await getAuthenticatedUser(request)
  const authenticatedUser = requireAuth(user)
  const { supabase } = createClient(request)

  return await callback({
    user: authenticatedUser,
    request,
    supabase,
  })
}

/**
 * Higher-order function for authenticated actions
 * Same as withAuth but specifically typed for actions
 */
export async function withAuthAction<T>(
  { request }: ActionFunctionArgs,
  callback: (context: AuthenticatedContext) => Promise<T>
): Promise<T> {
  return withAuth(request, callback)
}

/**
 * Higher-order function for authenticated loaders
 * Same as withAuth but specifically typed for loaders
 */
export async function withAuthLoader<T>(
  { request }: LoaderFunctionArgs,
  callback: (context: AuthenticatedContext) => Promise<T>
): Promise<T> {
  return withAuth(request, callback)
}

/**
 * Standard error response creator
 */
export function createErrorResponse<T>(error: string): ApiResponse<T> {
  return { success: false, error }
}

/**
 * Standard success response creator
 */
export function createSuccessResponse<T>(data?: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
  }
}

/**
 * Handle mock data in loaders with fallback
 */
export async function withMockDataFallback<T>(
  request: Request,
  getMockData: (request: Request) => Promise<T>,
  getRealData: () => Promise<T>
): Promise<T> {
  if (shouldUseMockData(request)) {
    return await getMockData(request)
  }
  return await getRealData()
}

/**
 * Common try-catch wrapper for actions/loaders
 */
export async function tryAsync<T>(
  operation: () => Promise<T>,
  errorMessage = 'Operation failed'
): Promise<T | ApiResponse> {
  try {
    return await operation()
  } catch (error) {
    console.error(errorMessage, error)
    return createErrorResponse(errorMessage)
  }
}

/**
 * Parse form data with error handling
 */
export function parseFormData<T>(formData: FormData, key: string): T | ApiResponse {
  try {
    const data = formData.get(key) as string
    if (!data) {
      return createErrorResponse(`Missing ${key} in form data`)
    }
    return JSON.parse(data) as T
  } catch (error) {
    return createErrorResponse(`Invalid ${key} format`)
  }
}
