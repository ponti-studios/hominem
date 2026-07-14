/**
 * Replace multiple spaces with a single space.
 * @param value The string to collapse whitespace in.
 * @returns The string with collapsed whitespace.
 */
function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function slugifyText(value: string | null): string | null {
  const normalized = (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return normalized.length > 0 ? normalized : null;
}

export function buildContentPreview(
  excerpt: string | null,
  content: string,
  maxLength = 240,
): string {
  const normalized = collapseWhitespace(excerpt ?? content);
  return normalized.slice(0, maxLength);
}
