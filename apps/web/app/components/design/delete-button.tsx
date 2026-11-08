import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Form } from 'react-router';

import { Button } from '~/components/ui/button';

type DeleteButtonProps = {
  itemName: string;
  label?: string;
  hiddenFields?: Record<string, string>;
  variant?: 'outline' | 'ghost';
  disabled?: boolean;
  /** Callback mode: confirm, then run instead of submitting a delete form. */
  onConfirm?: () => void | Promise<void>;
};

/**
 * Confirm-then-delete button. Form mode posts `intent=delete` (plus hidden
 * fields); callback mode runs `onConfirm` after confirmation. One pattern
 * for every destroy action.
 */
export function DeleteButton({
  itemName,
  label = 'Delete',
  hiddenFields,
  variant = 'outline',
  disabled,
  onConfirm,
}: DeleteButtonProps) {
  const [busy, setBusy] = useState(false);
  if (onConfirm) {
    return (
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={disabled || busy}
        onClick={() => {
          if (!confirm(`Delete "${itemName}"?`)) return;
          const result = onConfirm();
          if (result instanceof Promise) {
            setBusy(true);
            result.finally(() => setBusy(false));
          }
        }}
      >
        <Trash2 aria-hidden className="mr-2 size-4" />
        {busy ? 'Deleting…' : label}
      </Button>
    );
  }
  return (
    <Form
      method="post"
      onSubmit={(event) => {
        if (!confirm(`Delete "${itemName}"?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value="delete" />
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      <Button type="submit" variant={variant} size="sm" disabled={disabled}>
        <Trash2 aria-hidden className="mr-2 size-4" />
        {label}
      </Button>
    </Form>
  );
}
