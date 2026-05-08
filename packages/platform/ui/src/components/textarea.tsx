import * as React from 'react';

import { cn } from '../lib/utils';
import { Field } from './field';
import type { FieldBaseProps } from './field.types';

interface TextareaProps extends React.ComponentProps<'textarea'>, FieldBaseProps {}

const textareaClassName =
  'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

/**
 * Textarea — compound textarea with label, helper text, and error state.
 * Replaces raw `<textarea>` + `<label>` + error span patterns in feature code.
 *
 * @example
 * <Textarea label="Notes" helpText="Markdown supported" />
 * <Textarea label="Bio" error={errors.bio?.message} rows={4} />
 */
function Textarea({
  id,
  label,
  helpText,
  error,
  required,
  className,
  ...textareaProps
}: TextareaProps) {
  if (!label && !helpText && !error) {
    return (
      <textarea id={id} data-slot="textarea" className={cn(textareaClassName, className)} {...textareaProps} />
    );
  }

  return (
    <Field id={id} label={label} helpText={helpText} error={error} required={required}>
      <textarea
        id={id}
        data-slot="textarea"
        className={cn(textareaClassName, className)}
        {...textareaProps}
      />
    </Field>
  );
}

export { Textarea, type TextareaProps };
