const MAX_VALUE_LENGTH = 140;

// "create_collection" -> "Create collection".
export function formatToolName(toolName: string): string {
  const words = toolName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const single = (text ?? '').replace(/\s+/g, ' ').trim();
  return single.length > MAX_VALUE_LENGTH ? `${single.slice(0, MAX_VALUE_LENGTH - 1)}…` : single;
}

// A readable "Label: value" list for the approval card instead of raw JSON.
export function describeToolArgs(
  args: object | null | undefined,
): { label: string; value: string }[] {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return [];
  }
  return Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({ label: formatToolName(key), value: formatValue(value) }));
}
