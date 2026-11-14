import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

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
  controlClassName?: string;
  labelHidden?: boolean;
};

/** Labeled Base UI select with shared styling and accessible popup behavior. */
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
  controlClassName,
  labelHidden,
}: SelectFieldProps) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const setTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    setPortalContainer(node?.closest<HTMLElement>('[role="dialog"]') ?? null);
  }, []);

  return (
    <Field label={label} hint={hint} error={error} labelHidden={labelHidden} className={className}>
      {(id) => (
        <BaseSelect.Root
          modal={false}
          name={name}
          required={required}
          items={options}
          value={value === undefined ? undefined : value || null}
          defaultValue={value === undefined ? defaultValue || null : undefined}
          onValueChange={(nextValue) => onChange?.(nextValue ?? '')}
        >
          <BaseSelect.Trigger
            ref={setTriggerRef}
            id={id}
            aria-label={label}
            aria-invalid={error ? true : undefined}
            className={cn(
              'flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 data-placeholder:text-muted-foreground',
              controlClassName,
            )}
          >
            <BaseSelect.Value placeholder={placeholder} />
            <BaseSelect.Icon>
              <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
            </BaseSelect.Icon>
          </BaseSelect.Trigger>
          <BaseSelect.Portal container={portalContainer ?? undefined}>
            <BaseSelect.Positioner sideOffset={4} className="z-50 outline-none">
              <BaseSelect.Popup className="max-h-72 min-w-48 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
                <BaseSelect.List className="max-h-70 overflow-y-auto">
                  {options.map((option) => (
                    <BaseSelect.Item
                      key={option.value}
                      value={option.value}
                      className="relative flex min-h-10 w-full cursor-default items-center rounded-md py-2 pr-9 pl-3 text-sm outline-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50"
                    >
                      <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                      <BaseSelect.ItemIndicator className="absolute right-3 inline-flex items-center justify-center">
                        <Check aria-hidden className="size-4" />
                      </BaseSelect.ItemIndicator>
                    </BaseSelect.Item>
                  ))}
                </BaseSelect.List>
              </BaseSelect.Popup>
            </BaseSelect.Positioner>
          </BaseSelect.Portal>
        </BaseSelect.Root>
      )}
    </Field>
  );
}
