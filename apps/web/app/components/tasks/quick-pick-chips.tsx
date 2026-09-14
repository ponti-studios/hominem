import { m, useReducedMotion } from 'motion/react';

export function QuickPickChips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value?: T;
  onChange: (value: T) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <m.button
            animate={{ scale: active || reduceMotion ? 1 : 0.99 }}
            className={`rounded-full border px-3 py-1 text-xs transition-[background-color,border-color,color] motion-reduce:transition-none ${active ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
            key={String(option.value)}
            onClick={() => onChange(option.value)}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            type="button"
          >
            {option.label}
          </m.button>
        );
      })}
    </div>
  );
}
