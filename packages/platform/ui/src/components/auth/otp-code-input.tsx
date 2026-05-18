import { normalizeOtp } from '@hominem/auth/shared/validation';
import * as React from 'react';

import { cn } from '../../lib/utils';

interface OtpCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: string | undefined;
  onComplete?: (value: string) => void;
  maskDelay?: number;
}

export function OtpCodeInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  error,
  onComplete,
}: OtpCodeInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const normalizedValue = normalizeOtp(value).slice(0, length);

  React.useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = normalizeOtp(event.target.value).slice(0, length);
      onChange(next);
      if (next.length === length) {
        onComplete?.(next);
      }
    },
    [length, onChange, onComplete],
  );

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      const pasted = normalizeOtp(event.clipboardData.getData('text')).slice(0, length);
      if (!pasted) return;
      onChange(pasted);
      if (pasted.length === length) onComplete?.(pasted);
    },
    [length, onChange, onComplete],
  );

  return (
    <fieldset className="w-full border-0 p-0 m-0">
      <legend className="sr-only">Enter one-time code</legend>
      <div
        className={cn(
          'flex items-center min-h-12 rounded-xl border bg-surface px-3.5 py-3 transition-colors duration-120',
          'focus-within:border-border-focus focus-within:shadow-[0_0_0_2px_var(--color-bg-elevated),0_0_0_4px_var(--color-accent)]',
          error &&
            'border-destructive focus-within:shadow-[0_0_0_2px_var(--color-bg-elevated),0_0_0_4px_var(--color-destructive)]',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={length}
          value={normalizedValue}
          disabled={disabled}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={'––––––'.slice(0, length)}
          autoComplete="one-time-code"
          className={cn(
            'flex-1 bg-transparent text-base font-semibold text-text-primary placeholder:text-text-tertiary',
            'focus:outline-none tracking-[0.5em] disabled:cursor-not-allowed',
          )}
          aria-label="One-time verification code"
          aria-invalid={Boolean(error)}
        />
      </div>
    </fieldset>
  );
}
