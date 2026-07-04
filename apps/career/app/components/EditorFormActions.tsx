import { RotateCcwIcon, SaveIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@hominem/ui';

export interface EditorFormActionsProps {
  isSaving: boolean;
  isNew: boolean;
  isDirty: boolean;
  isValid: boolean;
  submitLabel: string;
  onDelete?: () => void;
  onReset?: () => void;
}

export function EditorFormActions({
  isSaving,
  isNew,
  isDirty,
  isValid,
  submitLabel,
  onDelete,
  onReset,
}: EditorFormActionsProps) {
  const isSubmitDisabled = isSaving || (!isDirty && !isNew) || !isValid;

  return (
    <div className="flex gap-1">
      {!isNew && onReset ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onReset}
          disabled={isSaving || !isDirty}
          title="Reset changes"
        >
          <RotateCcwIcon />
          <span className="sr-only">Reset changes</span>
        </Button>
      ) : null}

      <Button
        type="submit"
        size="icon"
        disabled={isSubmitDisabled}
        isLoading={isSaving}
        loadingLabel="Saving..."
        title={submitLabel}
      >
        <SaveIcon />
        <span className="sr-only">{submitLabel}</span>
      </Button>

      {!isNew && onDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={onDelete}
          disabled={isSaving}
          title="Delete"
        >
          <Trash2Icon />
          <span className="sr-only">Delete</span>
        </Button>
      ) : null}
    </div>
  );
}
