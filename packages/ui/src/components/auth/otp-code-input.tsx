import * as React from 'react';

import { cn } from '../../lib/utils';
import { Input } from '../ui/input';

interface OtpCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  error?: string | undefined;
  onComplete?: (value: string) => void;
}

export function OtpCodeInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  className,
  error,
  onComplete,
}: OtpCodeInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleChange = React.useCallback(
    (rawValue: string) => {
      const nextValue = rawValue.replace(/\D/g, '').slice(0, length);
      onChange(nextValue);

      if (nextValue.length === length) {
        onComplete?.(nextValue);
      }
    },
    [length, onChange, onComplete],
  );

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();

      const pastedValue = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pastedValue) {
        return;
      }

      const nextValue = pastedValue;
      onChange(nextValue);

      if (pastedValue.length === length) {
        onComplete?.(nextValue);
      }
    },
    [length, onChange, onComplete],
  );

  return (
    <fieldset className={cn('w-full', className)}>
      <legend className="sr-only">Enter one-time code</legend>
      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        value={value}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
        onPaste={handlePaste}
        className={cn(
          'bg-muted px-4 text-center font-mono font-semibold tracking-[0.5em] text-text-primary',
          error && 'focus-visible:ring-destructive/20 focus-visible:border-destructive',
        )}
        placeholder={'0'.repeat(length)}
        aria-label="One-time code"
        aria-invalid={Boolean(error)}
      />
    </fieldset>
  );
}
