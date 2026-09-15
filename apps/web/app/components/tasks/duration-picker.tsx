import { Stepper } from '@ponti-studios/ui/forms';

import { Input } from '~/components/ui/input';

export function DurationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const numericValue = Number(value) || 30;
  return (
    <div className="flex items-center gap-3">
      <Stepper
        className="w-36"
        max={1440}
        min={1}
        onChange={(next) => onChange(String(next))}
        step={5}
        value={numericValue}
      />
      <Input
        aria-label="Custom duration in minutes"
        className="w-24"
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
      <span className="text-xs text-muted-foreground">minutes</span>
    </div>
  );
}
