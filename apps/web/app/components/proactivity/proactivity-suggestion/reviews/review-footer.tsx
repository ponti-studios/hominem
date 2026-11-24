import { Button } from '~/components/ui/button';

export function ReviewFooter({
  applyLabel,
  applyDisabled,
  busy,
  onApply,
  onCancel,
}: {
  applyLabel: string;
  applyDisabled?: boolean;
  busy?: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <Button disabled={busy || applyDisabled} onClick={onApply} size="sm">
        {busy ? 'Applying…' : applyLabel}
      </Button>
      <Button disabled={busy} onClick={onCancel} size="sm" variant="outline">
        Cancel
      </Button>
    </div>
  );
}
