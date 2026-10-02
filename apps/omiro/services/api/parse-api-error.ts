import { isObject } from '@hominem/utils';

interface ApiErrorBody {
  error?: unknown;
  message?: unknown;
}

interface ApiResponseLike {
  json: () => Promise<unknown>;
}

export async function parseApiError(response: ApiResponseLike): Promise<ApiErrorBody> {
  const body: unknown = await response.json().catch(() => null);
  if (!isObject(body)) {
    return {};
  }
  return { error: Reflect.get(body, 'error'), message: Reflect.get(body, 'message') };
}
