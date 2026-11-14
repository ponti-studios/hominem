import { cn } from '~/lib/utils';

type CurrencyProps = {
  amount: number;
  currencyCode: string;
  className?: string;
};

export function Currency({ amount, currencyCode, className }: CurrencyProps) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
  });
  const formattedAmount = formatter.format(amount);
  const parts = formatter.formatToParts(amount);
  const numericPartTypes = new Set(['integer', 'group', 'decimal', 'fraction']);
  const firstNumericPart = parts.findIndex((part) => numericPartTypes.has(part.type));
  let lastNumericPart = firstNumericPart;

  for (let index = firstNumericPart + 1; index < parts.length; index += 1) {
    if (numericPartTypes.has(parts[index]!.type)) lastNumericPart = index;
  }

  const prefix = parts
    .slice(0, firstNumericPart)
    .map((part) => part.value)
    .join('');
  const value = parts
    .slice(firstNumericPart, lastNumericPart + 1)
    .map((part) => part.value)
    .join('');
  const suffix = parts
    .slice(lastNumericPart + 1)
    .map((part) => part.value)
    .join('');

  return (
    <span
      className={cn(
        'grid min-w-0 grid-cols-[3rem_minmax(5rem,1fr)] items-baseline gap-2 whitespace-nowrap tabular-nums sm:grid-cols-[3.5rem_minmax(6rem,1fr)]',
        suffix &&
          'grid-cols-[minmax(0,3rem)_minmax(5rem,1fr)_minmax(0,2rem)] sm:grid-cols-[minmax(0,3.5rem)_minmax(6rem,1fr)_minmax(0,2.5rem)]',
        className,
      )}
      dir="ltr"
      aria-label={formattedAmount}
    >
      <span className="truncate text-right">{prefix}</span>
      <span className="text-right">{value}</span>
      {suffix ? <span className="truncate text-left">{suffix}</span> : null}
    </span>
  );
}
