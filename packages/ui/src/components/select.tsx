import * as SelectPrimitive from '@base-ui-components/react/select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

function Select<Value = string, Multiple extends boolean | undefined = false>(
  props: React.ComponentProps<typeof SelectPrimitive.Select.Root<Value, Multiple>>,
) {
  return <SelectPrimitive.Select.Root data-slot="select" {...props} />;
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Select.Group>) {
  return <SelectPrimitive.Select.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  className,
  placeholder,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.Value> & {
  placeholder?: React.ReactNode;
}) {
  const valueChildren =
    placeholder == null || children != null
      ? children
      : (value: unknown) =>
          value == null || value === '' ? placeholder : (value as React.ReactNode);

  return (
    <SelectPrimitive.Select.Value
      data-slot="select-value"
      className={cn('line-clamp-1 flex items-center gap-2', className)}
      children={valueChildren}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.Trigger> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SelectPrimitive.Select.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*="text-"])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=default]:px-3 data-[size=default]:py-1 data-[size=default]:text-base data-[size=sm]:h-8 data-[size=sm]:px-2 data-[size=sm]:text-sm md:data-[size=default]:text-sm',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Select.Icon data-slot="select-icon">
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Select.Icon>
    </SelectPrimitive.Select.Trigger>
  );
}

function SelectContent({
  className,
  children,
  sideOffset = 4,
  alignItemWithTrigger = true,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.Popup> & {
  sideOffset?: number;
  alignItemWithTrigger?: boolean;
}) {
  return (
    <SelectPrimitive.Select.Portal>
      <SelectPrimitive.Select.Positioner
        alignItemWithTrigger={alignItemWithTrigger}
        sideOffset={sideOffset}
        className="z-50 w-[var(--anchor-width)]"
      >
        <SelectPrimitive.Select.Popup
          data-slot="select-content"
          className={cn(
            'bg-background text-foreground relative max-h-(--available-height) w-full overflow-hidden rounded-md border border-border shadow-medium',
            className,
          )}
          {...props}
        >
          <SelectPrimitive.Select.ScrollUpArrow
            data-slot="select-scroll-up-button"
            className="flex items-center justify-center py-1 text-muted-foreground"
          >
            <ChevronUpIcon className="size-4" />
          </SelectPrimitive.Select.ScrollUpArrow>
          <SelectPrimitive.Select.List className="p-1">{children}</SelectPrimitive.Select.List>
          <SelectPrimitive.Select.ScrollDownArrow
            data-slot="select-scroll-down-button"
            className="flex items-center justify-center py-1 text-muted-foreground"
          >
            <ChevronDownIcon className="size-4" />
          </SelectPrimitive.Select.ScrollDownArrow>
        </SelectPrimitive.Select.Popup>
      </SelectPrimitive.Select.Positioner>
    </SelectPrimitive.Select.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.GroupLabel>) {
  return (
    <SelectPrimitive.Select.GroupLabel
      data-slot="select-label"
      className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.Item>) {
  return (
    <SelectPrimitive.Select.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.Select.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.Select.ItemIndicator>
      </span>
      <SelectPrimitive.Select.ItemText>{children}</SelectPrimitive.Select.ItemText>
    </SelectPrimitive.Select.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.Separator>) {
  return (
    <SelectPrimitive.Select.Separator
      data-slot="select-separator"
      className={cn('my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.ScrollUpArrow>) {
  return (
    <SelectPrimitive.Select.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-muted-foreground',
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.Select.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Select.ScrollDownArrow>) {
  return (
    <SelectPrimitive.Select.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-muted-foreground',
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.Select.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
