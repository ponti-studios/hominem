import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { getServerSession, requireAuth, type User } from './auth.server';
import { logger } from './logger';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthenticatedContext {
  user: User;
  request: Request;
}

export async function withAuth<T>(
  request: Request,
  callback: (context: AuthenticatedContext) => Promise<T>,
): Promise<T> {
  const { user, headers } = await getServerSession(request);
  const authenticatedUser = requireAuth(user, headers);

  return callback({
    user: authenticatedUser,
    request,
  });
}

export async function withAuthAction<T>(
  { request }: ActionFunctionArgs,
  callback: (context: AuthenticatedContext) => Promise<T>,
): Promise<T> {
  return withAuth(request, callback);
}

export async function withAuthLoader<T>(
  { request }: LoaderFunctionArgs,
  callback: (context: AuthenticatedContext) => Promise<T>,
): Promise<T> {
  return withAuth(request, callback);
}

export function createErrorResponse<T>(error: string): ApiResponse<T> {
  return { success: false, error };
}

export function createSuccessResponse<T>(data?: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
  };
}

export async function tryAsync<T>(
  operation: () => Promise<T>,
  errorMessage = 'Operation failed',
): Promise<T | ApiResponse> {
  try {
    return await operation();
  } catch (error) {
    logger.error(
      errorMessage,
      error instanceof Error ? error : undefined,
      error instanceof Error ? undefined : { error },
    );
    return createErrorResponse(errorMessage);
  }
}

export function parseFormData<T>(formData: FormData, key: string): T | ApiResponse {
  try {
    const data = formData.get(key) as string;
    if (!data) {
      return createErrorResponse(`Missing ${key} in form data`);
    }
    return JSON.parse(data) as T;
  } catch {
    return createErrorResponse(`Invalid ${key} format`);
  }
}
