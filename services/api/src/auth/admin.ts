import { env } from '../env';

export function isAdminEmail(email: string, configuredEmails = env.HOMINEM_ADMIN_EMAILS): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  return configuredEmails
    .split(',')
    .some((adminEmail) => adminEmail.trim().toLowerCase() === normalizedEmail);
}
