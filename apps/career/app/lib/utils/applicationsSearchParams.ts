export function buildApplicationsSearchParams(
  currentSearchParams: URLSearchParams,
  updates: Record<string, string | string[] | null>,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(currentSearchParams);

  for (const [key, value] of Object.entries(updates)) {
    if (
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      nextSearchParams.delete(key);
      continue;
    }

    if (Array.isArray(value)) {
      nextSearchParams.delete(key);

      for (const item of value) {
        nextSearchParams.append(key, item);
      }

      continue;
    }

    nextSearchParams.set(key, value);
  }

  return nextSearchParams;
}
