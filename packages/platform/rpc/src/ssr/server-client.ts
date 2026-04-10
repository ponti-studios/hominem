import { createApiClientFromRaw, type ApiClient } from '../core/api-client'
import { createRawHonoClient } from '../core/raw-client'

export function createServerClient(
  baseUrl: string,
  request?: Request,
): ApiClient {
  const cookieHeader = request?.headers.get('Cookie') ?? request?.headers.get('cookie') ?? null

  return createApiClientFromRaw(
    createRawHonoClient({
      baseUrl,
      getHeaders: async () => {
        const headers: Record<string, string> = {}

        if (cookieHeader) {
          headers.cookie = cookieHeader
        }

        return headers
      },
      onError: (error) => {
        throw error
      },
    }),
  )
}

export const createServerHonoClient = createServerClient
