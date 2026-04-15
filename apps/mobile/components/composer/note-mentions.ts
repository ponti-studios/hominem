export function getTrailingMentionQuery(value: string): string | null {
  const match = /(?:^|\s)#([\w\s'-]+)$/i.exec(value);
  return match?.[1]?.toLowerCase().trim() ?? null;
}

export function removeTrailingMentionQuery(value: string): string {
  const match = /(?:^|\s)#[\w\s'-]+$/i.exec(value);

  if (!match || typeof match.index !== 'number') {
    return value;
  }

  return value.slice(0, match.index).trimEnd();
}
