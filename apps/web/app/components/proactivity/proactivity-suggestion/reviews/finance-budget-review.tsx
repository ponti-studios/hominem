import { useId, useState } from 'react';

import { Meter } from '~/components/design';

import type { ReviewProps } from '../types';
import { ReviewFooter } from './review-footer';

const currencyCode = (value: string) => value.toUpperCase();

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function money(amount: number, code: string, cents = false): string {
  const key = `${code}:${cents}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: cents ? 2 : 0,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(amount);
}

/**
 * The finance review the studio is centred on: one tag budget, adjustable
 * before it is written. The category and tag totals come from the suggestion,
 * so the invariant (tags cannot exceed the category budget) is visible.
 */
export function FinanceBudgetReview({ review, busy, onApply, onCancel }: ReviewProps) {
  if (review.kind !== 'finance.budget') return null;

  const [amount, setAmount] = useState(review.proposedAmount);
  const inputId = useId();
  const code = currencyCode(review.currency);
  const tagsAfter = Math.max(0, review.tagTotal - (review.currentAmount - amount));
  const unallocated = Math.max(0, review.categoryBudget - tagsAfter);
  const percent =
    review.categoryBudget > 0 ? Math.min(100, (tagsAfter / review.categoryBudget) * 100) : 0;
  const changed = amount !== review.currentAmount;

  return (
    <div>
      <p className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
        {review.category} · {review.tag} · {review.cadence}
      </p>

      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="text-sm text-muted-foreground line-through decoration-1">
          {money(review.currentAmount, code)}
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          →
        </span>
        <span className="text-2xl font-semibold tabular-nums">{money(amount, code)}</span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <label className="text-[13px] font-medium" htmlFor={inputId}>
            New limit
          </label>
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            now {money(review.currentAmount, code)}
          </span>
        </div>
        <input
          aria-valuemax={review.currentAmount}
          aria-valuemin={0}
          aria-valuenow={amount}
          className="mt-2 w-full cursor-pointer accent-foreground"
          id={inputId}
          max={review.currentAmount}
          min={0}
          onChange={(event) => setAmount(Number(event.target.value))}
          step={5}
          type="range"
          value={amount}
        />
        <div className="mt-1 flex justify-between font-mono text-[9.5px] text-muted-foreground">
          <span>{money(0, code)}</span>
          <span>{money(review.currentAmount, code)}</span>
        </div>
      </div>

      <div className="mt-4">
        <Meter
          description="Tag budgets after this change"
          label="Tags against the category"
          percent={percent}
          valueLabel={`${money(tagsAfter, code)} of ${money(review.categoryBudget, code)}`}
        />
        <p className="mt-2 text-[12px] text-muted-foreground">
          {unallocated > 0
            ? `${money(unallocated, code)} of the category stays unallocated.`
            : 'Every pound of the category stays allocated.'}{' '}
          Other tags are untouched.
        </p>
      </div>

      <p className="mt-4 border-t border-border pt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {review.note ??
          'This sets a firmer line for the rest of the period. It does not add money back, and you can undo it.'}
      </p>

      <ReviewFooter
        applyDisabled={!changed}
        applyLabel="Apply change"
        busy={busy}
        onApply={() => onApply(amount)}
        onCancel={onCancel}
      />
    </div>
  );
}
