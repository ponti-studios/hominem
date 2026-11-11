type MeterProps = {
  label: string;
  valueLabel: string;
  percent: number;
  description?: string;
};

/**
 * Labeled progress bar with an accessible text equivalent. Replaces every
 * hand-rolled ratio bar (top merchants, usage meters).
 */
export function Meter({ label, valueLabel, percent, description }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[13px] text-foreground">{label}</span>
        <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
          {valueLabel}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${label}, ${Math.round(clamped)} percent${description ? ` — ${description}` : ''}`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
