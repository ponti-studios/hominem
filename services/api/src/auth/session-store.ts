export interface RotatedTokenResult {
  ok: boolean;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  sessionId?: string;
  refreshFamilyId?: string;
}

export async function isSessionRevoked(_sessionId: string): Promise<boolean> {
  return false;
}

export async function revokeSession(_sessionId: string): Promise<void> {
  // no-op
}

export async function rotateRefreshToken(_refreshToken: string): Promise<RotatedTokenResult> {
  return {
    ok: true,
    accessToken: 'stub-access-token',
    refreshToken: 'stub-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    sessionId: 'stub-session-id',
    refreshFamilyId: 'stub-refresh-family-id',
  };
}
