import { storage } from '~/services/storage/mmkv';

const PENDING_AUTH_EMAIL_KEY = 'auth.pending-email';

export function readPendingAuthEmail() {
  return storage.getString(PENDING_AUTH_EMAIL_KEY) ?? '';
}

export function writePendingAuthEmail(email: string) {
  storage.set(PENDING_AUTH_EMAIL_KEY, email.trim().toLowerCase());
}

export function clearPendingAuthEmail() {
  storage.remove(PENDING_AUTH_EMAIL_KEY);
}
