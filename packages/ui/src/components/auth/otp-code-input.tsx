import * as React from "react";

import { OTP_LENGTH, normalizeOtp } from "../../lib";
import { cn } from "../../lib/utils";

export interface OtpCodeInputProps {
  id?: string;
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: string;
  onComplete?: (value: string) => void;
}

export function OtpCodeInput({
  id,
  length = OTP_LENGTH,
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
      const pasted = normalizeOtp(event.clipboardData.getData("text")).slice(0, length);
      if (!pasted) {
        return;
      }

      onChange(pasted);
      if (pasted.length === length) {
        onComplete?.(pasted);
      }
    },
    [length, onChange, onComplete],
  );

  return (
    <fieldset className="m-0 w-full border-0 p-0">
      <legend className="sr-only">Enter one-time code</legend>
      <div
        className={cn(
          "bg-surface flex min-h-12 items-center rounded-xl border px-3.5 py-3 transition-colors duration-120",
          "focus-within:border-border-focus focus-within:shadow-[0_0_0_2px_var(--color-bg-elevated),0_0_0_4px_var(--color-accent)]",
          error &&
            "border-destructive focus-within:shadow-[0_0_0_2px_var(--color-bg-elevated),0_0_0_4px_var(--color-destructive)]",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          id={id}
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={length}
          value={normalizedValue}
          disabled={disabled}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={"------".slice(0, length)}
          autoComplete="one-time-code"
          className={cn(
            "text-text-primary placeholder:text-text-tertiary flex-1 bg-transparent text-base font-semibold",
            "tracking-[0.5em] focus:outline-none disabled:cursor-not-allowed",
          )}
          aria-label="One-time verification code"
          aria-invalid={Boolean(error)}
        />
      </div>
    </fieldset>
  );
}
