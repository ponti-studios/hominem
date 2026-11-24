import type { ReviewProps } from '../types';
import { ReviewFooter } from './review-footer';

const dueFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Turns the evaluator's next step into a real task. */
export function TaskReview({ review, busy, onApply, onCancel }: ReviewProps) {
  if (review.kind !== 'task') return null;

  const due = new Date(review.dueAt);
  const dueLabel = Number.isNaN(due.getTime()) ? review.dueAt : dueFormat.format(due);

  return (
    <div>
      <p className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
        Add to tasks · {dueLabel}
      </p>
      <p className="mt-2 rounded-sm bg-muted px-3.5 py-3 text-[14px] leading-relaxed font-medium">
        {review.title}
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {review.note ??
          'One task, in the list you already use. You can edit or undo it afterwards.'}
      </p>
      <ReviewFooter
        applyLabel="Add task"
        busy={busy}
        onApply={() => onApply()}
        onCancel={onCancel}
      />
    </div>
  );
}
