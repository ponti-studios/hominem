import { m, useReducedMotion } from 'motion/react';

import type { Priority } from '~/hooks/use-task-form-draft';

const OPTIONS: { value: Priority; emoji: string; label: string }[] = [
  { value: 'low', emoji: '🟢', label: 'Low' },
  { value: 'medium', emoji: '🟡', label: 'Medium' },
  { value: 'high', emoji: '🔴', label: 'High' },
];

export function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (value: Priority) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div aria-label="Priority" className="grid grid-cols-3 gap-2" role="radiogroup">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <m.button
            animate={{ opacity: selected ? 1 : 0.78, scale: selected || reduceMotion ? 1 : 0.985 }}
            aria-checked={selected}
            className={`group relative flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none ${selected ? 'border-primary/50 bg-primary/8 shadow-sm' : 'border-border/70 bg-background/35 hover:border-primary/30 hover:bg-muted/50'}`}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            transition={{ duration: reduceMotion ? 0.08 : 0.2, ease: [0.23, 1, 0.32, 1] }}
            type="button"
          >
            <span aria-hidden="true" className="text-lg">
              {option.emoji}
            </span>
            <span>{option.label}</span>
            <span
              aria-hidden="true"
              className={`absolute right-2 top-2 flex size-4 items-center justify-center rounded border text-[10px] ${selected ? 'scale-100 border-primary bg-primary text-primary-foreground' : 'scale-90 border-border text-transparent'}`}
            >
              ✓
            </span>
          </m.button>
        );
      })}
    </div>
  );
}
