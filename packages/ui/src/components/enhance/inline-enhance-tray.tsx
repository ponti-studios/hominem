import { cn } from '../../lib/utils';
import { Button } from '../button';
import { Input } from '../input';

export interface InlineEnhanceTrayProps {
  instruction: string;
  onInstructionChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isEnhancing?: boolean;
  error?: string | null;
  suggestions?: readonly string[];
  title?: string;
  subtitle?: string;
  placeholder?: string;
  confirmLabel?: string;
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  'Fix grammar',
  'Make concise',
  'Make formal',
  'Expand ideas',
  'Simplify',
  'Add bullet points',
] as const;

export function InlineEnhanceTray({
  instruction,
  onInstructionChange,
  onCancel,
  onConfirm,
  isEnhancing = false,
  error = null,
  suggestions = DEFAULT_SUGGESTIONS,
  placeholder = 'e.g. Make it more engaging',
  confirmLabel = 'Enhance',
  className,
}: InlineEnhanceTrayProps) {
  return (
    <div className={cn('rounded-xl border bg-muted/40 p-2', className)}>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => {
          const isActive = instruction === suggestion;
          return (
            <button
              key={suggestion}
              type="button"
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs void-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'border-border-default bg-background text-foreground'
                  : 'border-border-subtle bg-background/70 text-text-secondary [--void-hover-bg:transparent] [--void-hover-border:var(--color-border-default)] [--void-hover-color:var(--color-foreground)]',
              )}
              onClick={() => onInstructionChange(suggestion)}
            >
              {suggestion}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Input
          value={instruction}
          onChange={(event) => onInstructionChange(event.target.value)}
          placeholder={placeholder}
          disabled={isEnhancing}
          className="sm:flex-1"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isEnhancing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isEnhancing}>
            {isEnhancing ? 'Enhancing...' : confirmLabel}
          </Button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
