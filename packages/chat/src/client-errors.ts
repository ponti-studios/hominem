const CLIENT_SAFE_CHAT_ERROR_CODES = new Set(['UNSUPPORTED_CAPABILITY']);

export function parseClientSafeChatError(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || !('code' in parsed)) return undefined;
    if (typeof parsed.code !== 'string' || !CLIENT_SAFE_CHAT_ERROR_CODES.has(parsed.code)) {
      return undefined;
    }
    return 'error' in parsed && typeof parsed.error === 'string' ? parsed.error : undefined;
  } catch {
    return undefined;
  }
}
