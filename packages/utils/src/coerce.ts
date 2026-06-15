export function nullToUndefined(value: string | null | undefined): string | undefined {
  return value === null ? undefined : value;
}

export function nullArrayToUndefined(value: unknown): string[] | undefined {
  return Array.isArray(value) ? (value as string[]) : undefined;
}
