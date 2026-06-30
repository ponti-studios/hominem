import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  increaseLabel?: string;
  decreaseLabel?: string;
}

function Stepper({
  value,
  min = 0,
  max = 100,
  step = 1,
  format,
  onChange,
  className,
  disabled,
  increaseLabel = "Increase",
  decreaseLabel = "Decrease",
}: StepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className={cn("border-border bg-muted flex items-center rounded-lg border", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={disabled || atMin}
        className="border-border text-muted-foreground rounded-none rounded-l-lg border-r"
        aria-label={decreaseLabel}
      >
        <Minus className="size-3.5" />
      </Button>
      <div className="flex min-w-[3ch] flex-1 items-center justify-center px-3">
        <span className="text-foreground font-['Geist'] text-sm font-semibold tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={disabled || atMax}
        className="border-border text-muted-foreground rounded-none rounded-r-lg border-l"
        aria-label={increaseLabel}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

export { Stepper };
export type { StepperProps };
