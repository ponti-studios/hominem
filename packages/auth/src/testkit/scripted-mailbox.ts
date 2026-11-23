// Inlined from @hominem/utils/email (scripted-mailbox.ts) — the utils package is
// workspace-only, and a published package can't ship a `workspace:*` dependency.
// Same caveats as upstream: local-file capture only, never over HTTP.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface ScriptedMailboxRecord {
  to: string;
  otp: string | null;
  subject: string;
  capturedAt: string;
}

export function resolveScriptedMailboxPath(explicit?: string): string {
  const override = explicit ?? process.env.HOMINEM_SCRIPTED_MAILBOX;
  if (override && override.length > 0) return override;
  return join(homedir(), '.hominem', 'scripted-mailbox.jsonl');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMailboxLine(line: string): ScriptedMailboxRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const to = Reflect.get(value, 'to');
  const otp = Reflect.get(value, 'otp');
  const capturedAt = Reflect.get(value, 'capturedAt');
  if (typeof to !== 'string' || typeof capturedAt !== 'string') return null;
  if (otp !== null && typeof otp !== 'string') return null;
  return { to, otp, subject: '', capturedAt };
}

// Latest captured OTP for an exact recipient address, or null. OTP sends run
// as a background task, so callers poll this until a record appears.
export function readLatestScriptedOtp(
  mailboxFile: string,
  email: string,
): ScriptedMailboxRecord | null {
  if (!existsSync(mailboxFile)) return null;
  let latest: ScriptedMailboxRecord | null = null;
  for (const line of readFileSync(mailboxFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const record = parseMailboxLine(line);
    if (!record || record.to !== email || !record.otp) continue;
    // >= (not >): capturedAt only has millisecond resolution, so two records
    // appended in the same tick tie — the later one in file order (append
    // order) must still win over the earlier one seen first in this loop.
    if (!latest || record.capturedAt >= latest.capturedAt) latest = record;
  }
  return latest;
}
