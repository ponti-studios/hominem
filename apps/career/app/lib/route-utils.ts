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
