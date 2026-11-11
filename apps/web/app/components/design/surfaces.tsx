import { motion } from 'motion/react';

import { cn } from '~/lib/utils';

/** Raised surface every domain builds on. Replaces ad-hoc rounded-sm borders. */
export function SectionCard({
  children,
  className,
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className={cn('hairline overflow-hidden rounded-sm bg-card', className)}
      initial={{ opacity: 0, y: 16 }}
      transition={{
        delay: Math.min(index * 0.06, 0.3),
        type: 'spring',
        stiffness: 280,
        damping: 30,
      }}
    >
      {children}
    </motion.section>
  );
}

/** Small label + big tabular figure. Used for stat strips and overviews. */
export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate text-2xl font-semibold tabular-nums',
          tone === 'danger' ? 'text-destructive-text' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** Shared empty/error/loading panel so domains stop hand-rolling variants. */
export function PanelState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon ? (
        <span className="hairline flex size-12 items-center justify-center rounded-sm bg-muted text-muted-foreground [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** Shared tab-like filter control (Open / Completed / All …). */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="hairline inline-flex items-center gap-0.5 rounded-full bg-muted p-1"
      role="group"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            aria-pressed={selected}
            className={cn(
              'relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              selected ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {selected ? (
              <motion.span
                className="absolute inset-0 rounded-full bg-primary"
                layoutId="segmented-active"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
