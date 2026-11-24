import type { ReviewProps } from '../types';
import { ReviewFooter } from './review-footer';

/** Stops evaluating a goal the person cannot act on right now. */
export function GoalPauseReview({ review, busy, onApply, onCancel }: ReviewProps) {
  if (review.kind !== 'goal.pause') return null;

  return (
    <div>
      <p className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
        Pause this goal
      </p>
      <p className="mt-2 text-[14px] leading-relaxed">
        I&rsquo;ll stop checking this goal{review.until ? ` until ${review.until}` : ''} and pick it
        up when you resume it. The goal, its history and its target stay exactly as they are.
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {review.note ?? 'Pausing is reversible and does not delete anything.'}
      </p>
      <ReviewFooter
        applyLabel="Pause goal"
        busy={busy}
        onApply={() => onApply()}
        onCancel={onCancel}
      />
    </div>
  );
}
