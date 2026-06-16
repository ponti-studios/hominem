import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

interface DatePickerProps {
  value: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabled?: boolean | undefined;
  id?: string | undefined;
  placeholder?: string | undefined;
  label?: string | undefined;
  dateFormat?: string | undefined;
  showLabel?: boolean | undefined;
  containerClassName?: string | undefined;
  popoverAlign?: 'start' | 'center' | 'end' | undefined;
  variant?: 'outline' | 'default' | 'destructive' | 'secondary' | 'ghost' | 'link' | undefined;
}

export function DatePicker({
  value,
  onSelect,
  disabled = false,
  id = 'date-picker',
  placeholder = 'Pick a date',
  label,
  dateFormat = 'MMM d, yyyy',
  showLabel = true,
  containerClassName = 'flex-1 min-w-[180px]',
  popoverAlign = 'start',
  variant = 'outline',
}: DatePickerProps) {
  return (
    <div className={containerClassName}>
      {showLabel && label && (
        <label htmlFor={id} className="block text-sm font-medium text-foreground mb-2">
          {label}
        </label>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            disabled={disabled}
            className="w-full justify-start bg-muted text-left font-normal placeholder:text-muted-foreground backdrop-blur-sm [--void-focus-shadow:0_0_0_2px_color-mix(in_srgb,var(--color-ring)_30%,transparent)]"
            id={id}
          >
            <CalendarIcon className="mr-2 size-4" />
            {value ? format(value, dateFormat) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-background" align={popoverAlign}>
          <Calendar mode="single" selected={value} onSelect={onSelect} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}
