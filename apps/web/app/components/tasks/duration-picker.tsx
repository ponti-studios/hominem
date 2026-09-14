import { Stepper } from '@ponti-studios/ui/forms';
import { useState } from 'react';

import { Input } from '~/components/ui/input';

import { QuickPickChips } from './quick-pick-chips';

const options = [
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1h', value: '60' },
  { label: '2h', value: '120' },
];

export function DurationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [custom, setCustom] = useState(false);
  const numericValue = Number(value) || 30;
  return (
    <div className="space-y-2">
      <QuickPickChips
        options={options}
        value={!custom ? value : undefined}
        onChange={(next) => {
          setCustom(false);
          onChange(next);
        }}
      />
      <button
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setCustom(true)}
        type="button"
      >
        {custom ? 'Custom duration' : 'Set a custom duration'}
      </button>
      {custom ? (
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
      ) : null}
    </div>
  );
}
