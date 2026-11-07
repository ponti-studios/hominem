import type { StudioAction, StudioView } from './types';

type ApiError = {
  error?: string;
  detail?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  const text = await response.text();
  if (!response.ok) {
    const error: ApiError = parseJson<ApiError>(text);
    throw new Error(error.detail ?? error.error ?? `Request failed (${response.status}).`);
  }
  return parseJson<T>(text);
}

function parseJson<T>(text: string): T {
  const value: T = JSON.parse(text || '{}');
  return value;
}

export function fetchStudio(): Promise<StudioView> {
  return request<StudioView>('/api/studio');
}

export function runEvent(eventId: string, force = false): Promise<StudioView> {
  return request<StudioView>('/api/run', {
    method: 'POST',
    body: JSON.stringify({ eventId, force }),
  });
}

export function injectShock(presetId: string): Promise<{ eventId: string; view: StudioView }> {
  return request<{ eventId: string; view: StudioView }>('/api/inject', {
    method: 'POST',
    body: JSON.stringify({ presetId }),
  });
}

export function setPreference(
  goalId: string,
  mode: 'snooze' | 'mute',
  days: number,
): Promise<StudioView> {
  return request<StudioView>('/api/preference', {
    method: 'POST',
    body: JSON.stringify({ goalId, mode, days }),
  });
}

export function clearPreference(goalId: string): Promise<StudioView> {
  return request<StudioView>('/api/preference/clear', {
    method: 'POST',
    body: JSON.stringify({ goalId }),
  });
}

export function acceptProposal(
  resultId: string,
): Promise<{ action: StudioAction; view: StudioView }> {
  return request<{ action: StudioAction; view: StudioView }>('/api/action', {
    method: 'POST',
    body: JSON.stringify({ resultId }),
  });
}

export function setActionStatus(id: string, status: 'open' | 'done'): Promise<StudioView> {
  return request<StudioView>('/api/action/status', {
    method: 'POST',
    body: JSON.stringify({ id, status }),
  });
}

export function resetStudio(): Promise<StudioView> {
  return request<StudioView>('/api/reset', { method: 'POST', body: '{}' });
}
