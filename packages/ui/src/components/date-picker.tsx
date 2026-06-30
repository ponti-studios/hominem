import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DatePickerProps {
  value: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  label?: string;
  dateFormat?: string;
  showLabel?: boolean;
  containerClassName?: string;
  popoverAlign?: "start" | "center" | "end";
  variant?: "outline" | "default" | "destructive" | "secondary" | "ghost" | "link";
}

export function DatePicker({
  value,
  onSelect,
  disabled = false,
  id = "date-picker",
  placeholder = "Pick a date",
  label,
  dateFormat = "MMM d, yyyy",
  showLabel = true,
  containerClassName = "flex-1 min-w-[180px]",
  popoverAlign = "start",
  variant = "outline",
}: DatePickerProps) {
  return (
    <div className={containerClassName}>
      {showLabel && label ? (
        <label htmlFor={id} className="text-foreground mb-2 block text-sm font-medium">
          {label}
        </label>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant={variant}
            disabled={disabled}
            className="bg-muted placeholder:text-muted-foreground w-full justify-start text-left font-normal backdrop-blur-sm [--void-focus-shadow:0_0_0_2px_color-mix(in_srgb,var(--color-ring)_30%,transparent)]"
          >
            <CalendarIcon className="mr-2 size-4" />
            {value ? format(value, dateFormat) : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="bg-background w-auto p-0" align={popoverAlign}>
          <Calendar mode="single" selected={value} onSelect={onSelect} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
