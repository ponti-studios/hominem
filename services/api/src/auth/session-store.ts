// Session store stub

export async function isSessionRevoked(_sessionId: string): Promise<boolean> {
  return false;
}

export async function revokeSession(_sessionId: string): Promise<void> {
  // no-op
}

export async function rotateRefreshToken(_sessionId: string): Promise<string> {
  return 'stub-refresh-token';
}
