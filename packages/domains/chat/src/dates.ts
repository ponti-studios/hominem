import { formatDistance, formatDistanceToNow } from 'date-fns';

export function parseInboxTimestamp(value: string | Date): Date {
  if (!(value instanceof Date) && typeof value !== 'string') {
    throw new Error(`Invalid inbox item timestamp: ${String(value)}`);
  }

  const normalizedInput = value instanceof Date ? value.toISOString() : value;
  const trimmed = normalizedInput.trim();
  if (!trimmed) {
    throw new Error('Invalid inbox item timestamp: empty string');
  }

  let normalized = trimmed.replace(' ', 'T');

  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid inbox item timestamp: ${value}`);
  }

  return date;
}

export function formatChatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const chatDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffInMs = today.getTime() - chatDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return 'Today';
  }
  if (diffInDays === 1) {
    return 'Yesterday';
  }
  return formatDistance(chatDate, today, { addSuffix: true });
}

export function formatMessageTimestamp(dateString: string): string {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}
