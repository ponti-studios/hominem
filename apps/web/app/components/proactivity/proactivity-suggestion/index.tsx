import { useState, type ComponentType } from 'react';

import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

import { FinanceBudgetReview } from './reviews/finance-budget-review';
import { FinanceChargesReview } from './reviews/finance-charges-review';
import { GoalPauseReview } from './reviews/goal-pause-review';
import { TaskReview } from './reviews/task-review';
import type { ReviewProps, SuggestionModel, SuggestionReview, SuggestionState } from './types';

export type ProactivitySuggestionProps = {
  suggestion: SuggestionModel;
  state: SuggestionState;
  busy?: boolean;
  defaultOpen?: boolean;
  defaultReviewing?: boolean;
  onApply: (input: { kind: SuggestionReview['kind']; value?: number }) => void;
  onUndo?: () => void;
  onSnooze?: () => void;
};

/** Add a review type here and the shell picks it up; no branch in the shell. */
const REVIEW_COMPONENTS: Record<SuggestionReview['kind'], ComponentType<ReviewProps>> = {
  'finance.budget': FinanceBudgetReview,
  'finance.charges': FinanceChargesReview,
  task: TaskReview,
  'goal.pause': GoalPauseReview,
};

const amountFormatters = new Map<string, Intl.NumberFormat>();

function money(amount: number, currency = 'GBP', cents = false): string {
  const key = `${currency}:${cents}`;
  let formatter = amountFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: cents ? 2 : 0,
    });
    amountFormatters.set(key, formatter);
  }
  return formatter.format(amount);
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function stateLabel(state: SuggestionState, snoozedUntil?: string): string {
  switch (state) {
    case 'applied':
      return 'Done';
    case 'snoozed':
      return snoozedUntil ? `Snoozed until ${dayFormat.format(new Date(snoozedUntil))}` : 'Snoozed';
    case 'waiting':
      return 'Waiting';
    default:
      return 'Needs you';
  }
}

function offerCopy(review: SuggestionReview): { title: string; effect: string; cta: string } {
  switch (review.kind) {
    case 'finance.budget':
      return {
        title: `Lower ${review.tag} from ${money(review.currentAmount, review.currency)} to ${money(review.proposedAmount, review.currency)} for the rest of the period.`,
        effect:
          'Your other budgets stay as they are. This will not add money back — it sets a firmer line, and you can undo it.',
        cta: 'Review and apply',
      };
    case 'finance.charges':
      return {
        title: 'Review the charges behind this finding.',
        effect: 'Prepared from your real transactions. Nothing is cancelled or contacted.',
        cta: 'Review the charges',
      };
    case 'task':
      return {
        title: 'Turn the next step into a task.',
        effect: 'One task, due tomorrow, in the list you already use. You can undo it.',
        cta: 'Review and apply',
      };
    case 'goal.pause':
      return {
        title: 'Pause this goal while there is nothing to act on.',
        effect: 'The goal, its history and its target stay as they are, and you can resume it.',
        cta: 'Review and apply',
      };
  }
}

export function ProactivitySuggestion({
  suggestion,
  state,
  busy,
  defaultOpen = false,
  defaultReviewing = false,
  onApply,
  onUndo,
  onSnooze,
}: ProactivitySuggestionProps) {
  const [reviewing, setReviewing] = useState(defaultReviewing);
  const [chargesOpen, setChargesOpen] = useState(false);
  const Review = REVIEW_COMPONENTS[suggestion.review.kind];
  const offer = offerCopy(suggestion.review);
  const settled = state === 'applied' || state === 'snoozed';
  const tone =
    state === 'applied'
      ? 'text-emerald-700 dark:text-emerald-400'
      : state === 'needs-you'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-muted-foreground';

  const apply = (value?: number) => {
    onApply({ kind: suggestion.review.kind, value });
    setReviewing(false);
  };

  return (
    <details
      className="group border-b border-border"
      ref={(element) => {
        if (element && defaultOpen && element.dataset.initialised !== 'true') {
          element.dataset.initialised = 'true';
          element.open = true;
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.13em] text-muted-foreground uppercase">
            {suggestion.goalTitle}
          </p>
          <p className="mt-1.5 max-w-[46ch] text-[17px] leading-snug font-semibold tracking-[-0.008em]">
            {suggestion.summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          <span className={cn('font-mono text-[9.5px] tracking-[0.13em] uppercase', tone)}>
            {stateLabel(state, suggestion.snoozedUntil)}
          </span>
          <span className="grid size-5 place-items-center rounded-full border border-border text-xs text-muted-foreground transition-transform group-open:rotate-45">
            +
          </span>
        </div>
      </summary>

      <div className="max-w-[62ch] pb-6">
        <p className="text-sm leading-relaxed text-muted-foreground">{suggestion.reason}</p>

        {settled ? (
          <div
            className={cn(
              'mt-4 flex items-center gap-2.5 rounded-sm px-3.5 py-2.5 text-[13px]',
              state === 'applied'
                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <span className="min-w-0 flex-1">
              {state === 'applied'
                ? (suggestion.appliedLabel ?? 'Done.')
                : `Snoozed until ${suggestion.snoozedUntil ? dayFormat.format(new Date(suggestion.snoozedUntil)) : 'later'}. I will only come back sooner if this changes materially.`}
            </span>
            {onUndo ? (
              <button
                className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50"
                disabled={busy}
                onClick={onUndo}
                type="button"
              >
                Undo
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-sm border border-border">
            <div className="border-b border-border px-4 py-2.5 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
              Review and apply
            </div>
            <div className="px-4 py-4">
              {reviewing ? (
                <Review
                  busy={busy}
                  onApply={apply}
                  onCancel={() => setReviewing(false)}
                  review={suggestion.review}
                />
              ) : (
                <>
                  <p className="text-[14.5px] leading-snug font-semibold">{offer.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {offer.effect}
                  </p>
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <Button disabled={busy} onClick={() => setReviewing(true)} size="sm">
                      {offer.cta}
                    </Button>
                    {onSnooze ? (
                      <Button disabled={busy} onClick={onSnooze} size="sm" variant="ghost">
                        Not now
                      </Button>
                    ) : null}
                    {suggestion.preparedCharges?.length ? (
                      <Button
                        className="ml-auto"
                        onClick={() => setChargesOpen((open) => !open)}
                        size="sm"
                        variant="outline"
                      >
                        {chargesOpen ? 'Hide charges' : 'Show the charges'}
                      </Button>
                    ) : null}
                  </div>

                  {chargesOpen && suggestion.preparedCharges?.length ? (
                    <div className="mt-4 border-t border-border pt-3">
                      <ul>
                        {suggestion.preparedCharges.map((charge) => (
                          <li
                            className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-[13px] text-muted-foreground last:border-0"
                            key={charge.merchant}
                          >
                            <span>
                              {charge.merchant}
                              {charge.charges > 1 ? ` · ${charge.charges} charges` : ''}
                            </span>
                            <span className="font-medium text-foreground tabular-nums">
                              {money(charge.amount, 'GBP', true)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11.5px] text-muted-foreground">
                        November&rsquo;s largest non-transfer charges. Nothing is cancelled or
                        contacted.
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export type { PreparedCharge, SuggestionModel, SuggestionReview, SuggestionState } from './types';
