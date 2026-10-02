export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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

/** A text field's value, or `undefined` when it is absent or a file upload. */
export function formText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

/** A text field restricted to a known set of values; falls back when absent or unknown. */
export function formChoice<TChoice extends string>(
  formData: FormData,
  key: string,
  choices: readonly TChoice[],
  fallback: TChoice,
): TChoice {
  const value = formText(formData, key);
  return choices.find((choice) => choice === value) ?? fallback;
}

export function isApiResponse(value: unknown): value is ApiResponse {
  return typeof value === 'object' && value !== null && 'success' in value;
}

export function parseFormData<T>(formData: FormData, key: string): T | ApiResponse {
  try {
    const data = formText(formData, key);
    if (!data) {
      return createErrorResponse(`Missing ${key} in form data`);
    }
    return JSON.parse(data);
  } catch {
    return createErrorResponse(`Invalid ${key} format`);
  }
}
