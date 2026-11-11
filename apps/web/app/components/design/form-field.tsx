import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

import { cn } from '~/lib/utils';

type FieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  /** Visually hide the label while keeping it programmatically associated. */
  labelHidden?: boolean;
  children: (id: string) => React.ReactNode;
  className?: string;
};

/**
 * Label + control + hint/error composition. Every form in routes and
 * modules must go through this instead of bare `<label>` grids, so
 * labeling, spacing, and error display stay uniform.
 */
export function Field({ label, hint, error, labelHidden, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label
        htmlFor={id}
        className={labelHidden ? 'sr-only' : 'text-sm font-medium text-foreground'}
      >
        {label}
      </label>
      {children(id)}
      {hint && !error ? (
        <p id={hintId} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-destructive-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  options: readonly { value: string; label: string }[];
  hint?: string;
  error?: string | null;
  className?: string;
  labelHidden?: boolean;
};

/** Dark-styled native select. Replaces every raw `<select>` in the app. */
export function SelectField({
  label,
  name,
  defaultValue = '',
  value,
  onChange,
  required,
  placeholder = 'Choose…',
  options,
  hint,
  error,
  className,
  labelHidden,
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} labelHidden={labelHidden} className={className}>
      {(id) => (
        <span className="relative block">
          <select
            id={id}
            name={name}
            required={required}
            value={value}
            defaultValue={value === undefined ? defaultValue : undefined}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            aria-label={label}
            className="h-10 w-full appearance-none rounded-sm border border-border bg-muted pr-10 pl-3 text-sm text-foreground outline-none transition-colors focus:border-ring [&>option]:bg-popover"
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </span>
      )}
    </Field>
  );
}
