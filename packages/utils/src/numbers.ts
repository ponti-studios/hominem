// Intl.NumberFormat construction costs far more than format(), and these run
// per row and per chart tick in the finance UIs — hold one formatter per
// distinct options key.
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(key: string, make: () => Intl.NumberFormat): Intl.NumberFormat {
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = make();
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatPercentage(value: number, decimals = 1, locale?: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%';
  const formatter = formatterFor(
    `percent|${locale ?? ''}|${decimals}`,
    () =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
  );
  return formatter.format(value);
}

export function formatCurrency(amount: number, currency = 'USD', locale?: string): string {
  const formatter = formatterFor(
    `currency|${locale ?? ''}|${currency}`,
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
  );
  return formatter.format(amount);
}

export function formatNumber(num: number, locale?: string): string {
  const formatter = formatterFor(
    `compact|${locale ?? ''}`,
    () =>
      new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
  );
  return formatter.format(num);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}
