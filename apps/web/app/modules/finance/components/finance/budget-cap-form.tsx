import { useFetcher } from 'react-router';

import { Field } from '~/components/design/form-field';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';

function toErrorMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const error: unknown = Object.fromEntries(Object.entries(data)).error;
  return typeof error === 'string' && error.length > 0 ? error : null;
}

type BudgetCapFormProps = {
  /** Hidden fields submitted with the form (categoryId, currencyCode). */
  hiddenFields: Record<string, string>;
  defaultAmount?: number;
  submitLabel: string;
  /** Extra controls rendered before the amount (e.g. the category select). */
  leading?: React.ReactNode;
  /** Row mode: inline compact control. Form mode: wrapped with visible label. */
  layout?: 'inline' | 'stacked';
  disabled?: boolean;
  className?: string;
};

/**
 * The single budget-cap editor. Used for every existing category-cap row
 * and for the add-new-cap form — same amount field, same save button,
 * same error display. Each instance owns its fetcher so rows submit and
 * disable independently.
 */
export function BudgetCapForm({
  hiddenFields,
  defaultAmount,
  submitLabel,
  leading,
  layout = 'stacked',
  disabled,
  className,
}: BudgetCapFormProps) {
  const fetcher = useFetcher();
  const pending = fetcher.state !== 'idle';
  const inline = layout === 'inline';
  const errorMessage = toErrorMessage(fetcher.data);

  return (
    <fetcher.Form
      method="post"
      className={cn(
        inline ? 'flex items-center gap-2' : 'flex flex-wrap items-end gap-3',
        className,
      )}
    >
      <input type="hidden" name="intent" value="budget" />
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {leading}
      <Field label="Monthly cap" labelHidden={inline}>
        {(id) => (
          <Input
            id={id}
            className={inline ? 'max-w-32' : undefined}
            aria-label={inline ? 'Monthly cap' : undefined}
            name="amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultAmount}
            required
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="outline"
        size={inline ? 'sm' : 'default'}
        disabled={disabled ?? pending}
      >
        {pending ? 'Saving…' : submitLabel}
      </Button>
      {errorMessage ? (
        <p role="alert" className="w-full text-sm text-destructive-text">
          {errorMessage}
        </p>
      ) : null}
    </fetcher.Form>
  );
}
