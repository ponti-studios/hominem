import { useId } from 'react';
import { useNavigation } from 'react-router';

import { Field } from '~/components/design/form-field';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';

/** Input with a leading icon affordance. Merges the old EmailField/PhoneField pair. */
export function IconField({
  label,
  icon,
  name,
  field,
  value,
  defaultValue,
  onChange,
  placeholder,
  type,
  required,
  disabled,
  readOnly,
  hint,
  error,
  inputClassName,
  className,
  ...rest
}: {
  label: string;
  icon: React.ReactNode;
  name: string;
  field?: FieldBinding;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  hint?: string;
  error?: string | null;
  inputClassName?: string;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'name'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'placeholder'
  | 'type'
  | 'required'
  | 'disabled'
  | 'readOnly'
  | 'className'
>) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => (
        <span className="flex">
          <span className="inline-flex h-10 shrink-0 items-center rounded-l-xl border border-r-0 border-border bg-muted px-3 text-muted-foreground">
            {icon}
          </span>
          <Input
            id={id}
            name={field?.name ?? name}
            value={field?.value ?? value}
            defaultValue={field || value !== undefined ? undefined : defaultValue}
            onChange={
              field
                ? (e) => field.onChange(e.target.value)
                : onChange
                  ? (e) => onChange(e.target.value)
                  : undefined
            }
            onBlur={field?.onBlur}
            placeholder={placeholder}
            type={type}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={error ? true : undefined}
            className={cn('rounded-l-none', inputClassName)}
            {...rest}
          />
        </span>
      )}
    </Field>
  );
}

/** Minimal field contract for controlled inputs. Wrap react-hook-form's
 * Controller output in an adapter lambda at the call site. */
export type FieldBinding = {
  value: string;
  name: string;
  onChange: (value: string) => void;
  onBlur: () => void;
};

type TextInputProps = {
  label: string;
  name: string;
  field?: FieldBinding;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number | string;
  inputClassName?: string;
  labelHidden?: boolean;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'name'
  | 'type'
  | 'required'
  | 'placeholder'
  | 'min'
  | 'max'
  | 'step'
  | 'className'
  | 'defaultValue'
>;

/**
 * Labeled dark input. Replaces every `div.space-y-2 > label + Input`
 * pair in editors and route forms.
 */
export function TextInput({
  label,
  name,
  field,
  defaultValue = '',
  value,
  type,
  required,
  placeholder,
  hint,
  min,
  max,
  step,
  inputClassName,
  labelHidden,
  className,
  ...rest
}: TextInputProps) {
  const id = useId();
  return (
    <div className={cn('grid gap-0', className)}>
      <label
        htmlFor={id}
        className={
          labelHidden
            ? 'sr-only'
            : 'z-10 w-fit rounded-t-md border border-border border-b-0 bg-muted px-3 py-1 text-xs font-normal text-foreground'
        }
      >
        {label}
      </label>
      <Input
        id={id}
        name={field?.name ?? name}
        value={field?.value ?? value}
        defaultValue={field || value !== undefined ? undefined : defaultValue}
        onChange={field ? (e) => field.onChange(e.target.value) : undefined}
        onBlur={field?.onBlur}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className={cn('h-10 rounded-tl-none', inputClassName)}
        {...rest}
      />
      {hint ? <p className="mt-1.5 truncate text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type CurrencyFieldProps = Omit<TextInputProps, 'type'> & {
  currency?: string;
};

export function CurrencyField({
  label,
  name,
  field,
  defaultValue = '',
  value,
  currency,
  required,
  placeholder,
  hint,
  min,
  max,
  step,
  inputClassName,
  labelHidden,
  className,
  ...rest
}: CurrencyFieldProps) {
  const id = useId();
  const currencySymbol = currency
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value
    : null;
  return (
    <div className={cn('grid gap-0', className)}>
      <label
        htmlFor={id}
        className={
          labelHidden
            ? 'sr-only'
            : 'z-10 w-fit rounded-t-md border border-border border-b-0 bg-muted px-3 py-1 text-xs font-normal text-foreground'
        }
      >
        {label}
      </label>
      <div className="relative">
        {currencySymbol ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
          >
            {currencySymbol}
          </span>
        ) : null}
        <Input
          id={id}
          name={field?.name ?? name}
          value={field?.value ?? value}
          defaultValue={field || value !== undefined ? undefined : defaultValue}
          onChange={field ? (event) => field.onChange(event.target.value) : undefined}
          onBlur={field?.onBlur}
          type={rest.readOnly ? 'text' : 'number'}
          required={required}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={cn('h-10 rounded-tl-none', currencySymbol && 'pl-14', inputClassName)}
          {...rest}
        />
      </div>
      {hint ? <p className="mt-1.5 truncate text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type TextAreaInputProps = {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  labelHidden?: boolean;
  className?: string;
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'name' | 'rows' | 'required' | 'placeholder' | 'className' | 'defaultValue'
>;

/** Labeled dark textarea. Replaces every hand-rolled textarea block. */
export function TextAreaInput({
  label,
  name,
  defaultValue = '',
  rows = 4,
  required,
  placeholder,
  hint,
  labelHidden,
  className,
  ...rest
}: TextAreaInputProps) {
  return (
    <Field label={label} hint={hint} labelHidden={labelHidden} className={className}>
      {(id) => (
        <textarea
          id={id}
          name={name}
          rows={rows}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="w-full resize-none rounded-sm border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          {...rest}
        />
      )}
    </Field>
  );
}

type PrefixInputProps = {
  label: React.ReactNode;
  name: string;
  prefix: string;
  field?: FieldBinding;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  labelHidden?: boolean;
  suffix?: React.ReactNode;
  inputClassName?: string;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'placeholder' | 'required' | 'className'
>;

/**
 * Input with a fixed URL-style prefix and optional trailing status icon.
 * Serves profile slugs and social usernames — one component instead of
 * three hand-rolled prefix rows.
 */
export function PrefixInput({
  label,
  name,
  prefix,
  field,
  value,
  defaultValue,
  onChange,
  placeholder,
  required,
  hint,
  error,
  suffix,
  inputClassName,
  className,
  labelHidden,
  ...rest
}: PrefixInputProps) {
  const id = useId();
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label
        htmlFor={id}
        className={
          labelHidden ? 'sr-only' : 'flex items-center gap-2 text-sm font-medium text-foreground'
        }
      >
        {label}
      </label>
      <span className="flex">
        <span className="inline-flex shrink-0 items-center rounded-l-xl border border-r-0 border-border bg-muted px-3 text-[13px] text-muted-foreground">
          {prefix}
        </span>
        <span className="relative min-w-0 flex-1">
          <Input
            id={id}
            name={field?.name ?? name}
            value={field?.value ?? value}
            defaultValue={field || value !== undefined ? undefined : defaultValue}
            onChange={
              field
                ? (e) => field.onChange(e.target.value)
                : onChange
                  ? (e) => onChange(e.target.value)
                  : undefined
            }
            onBlur={field?.onBlur}
            placeholder={placeholder}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={hint || error ? `${id}-note` : undefined}
            className={cn('rounded-l-none', suffix && 'pr-10', inputClassName)}
            {...rest}
          />
          {suffix ? (
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
              {suffix}
            </span>
          ) : null}
        </span>
      </span>
      {hint && !error ? (
        <p id={`${id}-note`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-note`} role="alert" className="text-[13px] text-destructive-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FormGridProps = {
  children: React.ReactNode;
  cols?: 2 | 3;
  className?: string;
};

/** Responsive form grid. One pattern instead of a dozen grid class strings. */
export function FormGrid({ children, cols = 2, className }: FormGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4',
        cols === 2 && 'md:grid-cols-2',
        cols === 3 && 'md:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

type FormActionsProps = {
  submitLabel: string;
  onCancel?: () => void;
  cancelLabel?: string;
  className?: string;
};

/** Right-aligned cancel + submit footer with pending state. */
export function FormActions({
  submitLabel,
  onCancel,
  cancelLabel = 'Cancel',
  className,
}: FormActionsProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  return (
    <div className={cn('flex justify-end gap-3', className)}>
      {onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : submitLabel}
      </Button>
    </div>
  );
}
