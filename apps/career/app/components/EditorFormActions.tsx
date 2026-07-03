import { Button } from '@hominem/ui';

export interface EditorFormActionsProps {
  isSaving: boolean;
  isNew: boolean;
  isDirty: boolean;
  isValid: boolean;
  submitLabel: string;
  onDelete?: () => void;
}

export function EditorFormActions({
  isSaving,
  isNew,
  isDirty,
  isValid,
  submitLabel,
  onDelete,
}: EditorFormActionsProps) {
  const isSubmitDisabled = isSaving || (!isDirty && !isNew) || !isValid;

  return (
    <div className="flex gap-2">
      <Button
        type="submit"
        disabled={isSubmitDisabled}
        size="sm"
        isLoading={isSaving}
        loadingLabel="Saving..."
      >
        {submitLabel}
      </Button>
      {!isNew && onDelete ? (
        <Button
          type="button"
          onClick={onDelete}
          disabled={isSaving}
          variant="destructive"
          size="sm"
        >
          Delete
        </Button>
      ) : null}
    </div>
  );
}
