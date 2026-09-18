// Same-origin fetch helper for the auth UI's data endpoints (tokens, usage).
// Form submissions (login/OTP/consent/logout) stay native <form> posts so the
// server's redirect handling stays authoritative; only read + JSON mutations
// go through here.

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = 'Request failed.';
    try {
      const body: { error?: unknown } | null = await response.json().catch(() => null);
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
