import type { DecisionKind, Evidence } from './types';

export const kindLabel: Record<DecisionKind, string> = {
  propose: 'Needs you',
  defer: 'Waiting',
  quiet: 'No action',
};

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function formatRelative(iso: string, now: string): string {
  const delta = Date.parse(now) - Date.parse(iso);
  if (!Number.isFinite(delta) || delta < 0) return 'just now';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase();
}

export function isSensitiveKey(key: string): boolean {
  return key.toLowerCase().includes('private');
}

export function formatFactValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateShort(value);
    return value.length > 220 ? `${value.slice(0, 217)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? '—' : value.map(formatArrayItem).join(' · ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, entry]) => `${humanizeKey(key)}: ${formatFactValue(entry)}`)
      .join(' · ');
  }
  return String(value);
}

function formatArrayItem(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string'
  ) {
    return 'amount' in value && value.amount !== undefined
      ? `${value.name} (${formatFactValue(value.amount)})`
      : value.name;
  }
  return formatFactValue(value);
}

const sourceNames: Record<string, string> = {
  Monzo: 'Monzo sync',
  Amex: 'Amex statement',
  Gmail: 'Gmail',
  'Apple Health': 'Apple Health',
  Payslip: 'Payslip',
  'Landlord email': 'Rent notice',
  'Care agency': 'Care assessment',
  Booking: 'Booking',
  Injected: 'Injected fact',
};

export function evidenceName(evidence: Evidence): string {
  return sourceNames[evidence.source] ?? humanizeKey(evidence.source);
}

const qualityLabels: Record<string, string> = {
  duplicate_unreconciled: 'The duplicate charge still needs reconciling.',
  missing_current_measurements: 'The current measurements have not arrived yet.',
  missing_required_support_hours: 'The support hours have not been confirmed yet.',
  stale: 'The supporting data is out of date.',
};

export function friendlyDefer(reason: string): string {
  const quality = /flagged as ([a-z_]+)/.exec(reason)?.[1];
  if (quality && qualityLabels[quality]) return qualityLabels[quality];
  if (/more than seven days old/.test(reason)) {
    return 'The newest data is more than a week old.';
  }
  if (/No current evidence/.test(reason)) {
    return 'There is no current data for this goal yet.';
  }
  return reason;
}

export function decisionHeadline(decision: {
  kind: DecisionKind;
  summary?: string;
  reason: string;
}): string {
  if (decision.kind === 'propose') return decision.summary ?? 'A change worth acting on.';
  if (decision.kind === 'defer') return friendlyDefer(decision.reason);
  return decision.reason;
}

export function matchTarget(
  kind: DecisionKind,
  expected: DecisionKind | null,
): 'match' | 'miss' | 'none' {
  if (!expected) return 'none';
  return kind === expected ? 'match' : 'miss';
}

export function IconPlay({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 3.5 12 8l-7 4.5v-9Z" fill="currentColor" />
    </svg>
  );
}

export function IconArrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 12 12 4M6 4h6v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    </svg>
  );
}

export function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m3 8.5 3.2 3.2L13 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function IconClose({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconRefresh({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 8a5 5 0 1 1-1.5-3.6M13 3v4H9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function IconChevron({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m6 3.5 4.5 4.5L6 12.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function IconMail({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" stroke="currentColor" strokeWidth="1.2" />
      <path d="m2.5 4 5.5 4.5L13.5 4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 5v3.3l2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
    </svg>
  );
}
