import type { ReviewProps } from '../types';
import { ReviewFooter } from './review-footer';

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
});

/** Read-only preparation: the largest non-transfer charges behind a finding. */
export function FinanceChargesReview({ review, busy, onApply, onCancel }: ReviewProps) {
  if (review.kind !== 'finance.charges') return null;

  const total = review.charges.reduce((sum, charge) => sum + charge.amount, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
          Charges to look at
        </p>
        <span className="text-sm font-semibold tabular-nums">{gbp.format(total)}</span>
      </div>

      <ul className="mt-2">
        {review.charges.map((charge) => (
          <li
            className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-[13px] last:border-0"
            key={charge.merchant}
          >
            <span className="min-w-0 text-foreground">
              {charge.merchant}
              {charge.charges > 1 ? (
                <span className="text-muted-foreground"> · {charge.charges} charges</span>
              ) : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{gbp.format(charge.amount)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
        {review.note ?? 'Prepared from your real transactions. Nothing is cancelled or contacted.'}
      </p>

      <ReviewFooter applyLabel="Done" busy={busy} onApply={() => onApply()} onCancel={onCancel} />
    </div>
  );
}
