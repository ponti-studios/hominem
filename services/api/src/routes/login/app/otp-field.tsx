// @jsxImportSource react
import { useCallback, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import styles from './otp-field.module.css';

type OtpFieldProps = {
  onDigitsChange: (digits: string) => void;
};

const LENGTH = 6;

export function OtpField({ onDigitsChange }: OtpFieldProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const syncHidden = useCallback(
    (digits: string[]) => {
      onDigitsChange(digits.join(''));
    },
    [onDigitsChange],
  );

  const fill = (start: HTMLInputElement, value: string) => {
    const digits = value.replace(/\D/g, '');
    const startIndex = refs.current.indexOf(start);
    if (!digits || startIndex < 0) return;
    const next = [...Array(LENGTH)].map((_, index) => refs.current[index]?.value ?? '');
    digits.split('').forEach((digit, index) => {
      next[startIndex + index] = digit;
    });
    refs.current.forEach((input, index) => {
      if (input) input.value = next[index] ?? '';
    });
    syncHidden(next);
    const focusIndex = Math.min(startIndex + digits.length, LENGTH - 1);
    refs.current[focusIndex]?.focus();
  };

  const handleInput = (index: number, value: string) => {
    const input = refs.current[index];
    if (!input) return;
    if (value.length > 1) {
      fill(input, value);
      return;
    }
    const digits = Array.from({ length: LENGTH }, (_, i) => refs.current[i]?.value ?? '');
    digits[index] = value.replace(/\D/g, '');
    if (value && index < LENGTH - 1) refs.current[index + 1]?.focus();
    syncHidden(digits);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    const input = refs.current[index];
    if (!input) return;
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    if (input.value) return;
    event.preventDefault();
    const previous = refs.current[index - 1];
    if (!previous) return;
    previous.value = '';
    previous.focus();
    const digits = Array.from({ length: LENGTH }, (_, i) => refs.current[i]?.value ?? '');
    digits[index - 1] = '';
    syncHidden(digits);
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const input = refs.current[index];
    if (!input) return;
    event.preventDefault();
    fill(input, event.clipboardData.getData('text'));
  };

  return (
    <div aria-label="One-time verification code" className={styles['otp-field']} role="group">
      {Array.from({ length: LENGTH }, (_, index) => (
        <span className={styles['otp-tile']} key={index} style={{ ['--i' as string]: index }}>
          <input
            aria-label={`Character ${index + 1} of 6`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            autoFocus={index === 0}
            className={styles['otp-input']}
            data-otp-digit
            inputMode="numeric"
            maxLength={1}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onInput={(event) => handleInput(index, event.currentTarget.value)}
            onPaste={(event) => handlePaste(index, event)}
            pattern="[0-9]"
            ref={(node) => {
              refs.current[index] = node;
            }}
            required
            type="text"
          />
        </span>
      ))}
    </div>
  );
}
