// @ts-nocheck
/* eslint-disable */

import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { getServerSession, requireAuth, type User } from './auth.server';
import { shouldUseMockData } from './utils/mock-data';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
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

  return await callback({
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

export async function withMockDataFallback<T>(
  request: Request,
  getMockData: (request: Request) => Promise<T>,
  getRealData: () => Promise<T>,
): Promise<T> {
  if (shouldUseMockData(request)) {
    return await getMockData(request);
  }
  return await getRealData();
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

function getNestedErrors(error: unknown): unknown[] {
  if (typeof error !== 'object' || error === null) return [];

  const nested: unknown[] = [];
  if ('cause' in error) nested.push((error as { cause?: unknown }).cause);
  if ('errors' in error) {
    const errors = (error as { errors?: unknown }).errors;
    if (Array.isArray(errors)) nested.push(...errors);
  }

  return nested.filter(Boolean);
}

export function isDatabaseConnectionError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === 'ECONNREFUSED') return true;

  return getNestedErrors(error).some(isDatabaseConnectionError);
}

export async function tryAsync<T>(
  operation: () => Promise<T>,
  errorMessage = 'Operation failed',
): Promise<T | ApiResponse> {
  try {
    return await operation();
  } catch (error) {
    console.error(errorMessage, error);
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
  } catch (error) {
    return createErrorResponse(`Invalid ${key} format`);
  }
}
