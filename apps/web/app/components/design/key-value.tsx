import { cn } from '~/lib/utils';

type KeyValueProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'default' | 'volt' | 'success' | 'danger';
  className?: string;
};

const TONES = {
  default: 'text-[#f2f4f8]',
  volt: 'text-[#d7ff3e]',
  success: 'text-[#6ee7a0]',
  danger: 'text-[#ff9d9d]',
} as const;

/**
 * Label/value row for totals, settings, and summary lists. Compose
 * inside KeyValueList for hairline dividers.
 */
export function KeyValue({ label, value, tone = 'default', className }: KeyValueProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-4', className)}>
      <span className="inline-flex items-center gap-2 text-[13px] text-[#9ba3b4]">{label}</span>
      <span className={cn('text-right text-lg font-medium tabular-nums', TONES[tone])}>
        {value}
      </span>
    </div>
  );
}

export function KeyValueList({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-1 flex-col justify-between divide-y divide-white/[0.06] border-t border-white/[0.06]">
      {children}
    </div>
  );
}
