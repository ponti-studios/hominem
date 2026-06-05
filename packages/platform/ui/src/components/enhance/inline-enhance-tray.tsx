import { Sparkles } from 'lucide-react';

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
  title = 'Enhance text',
  subtitle = "Describe how you'd like to improve this text, or pick a suggestion.",
  placeholder = 'e.g. Make it more engaging',
  confirmLabel = 'Enhance',
  className,
}: InlineEnhanceTrayProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border-subtle bg-muted/40 p-3 sm:p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-border-subtle bg-background p-2 text-text-secondary">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => {
          const isActive = instruction === suggestion;
          return (
            <button
              key={suggestion}
              type="button"
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                isActive
                  ? 'border-border-default bg-background text-foreground'
                  : 'border-border-subtle bg-background/70 text-text-secondary hover:border-border-default hover:text-foreground',
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
          <Button variant="primary" onClick={onConfirm} isLoading={isEnhancing}>
            {confirmLabel}
          </Button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
