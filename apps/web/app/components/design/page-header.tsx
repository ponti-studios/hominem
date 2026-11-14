/**
 * Shared page heading with an optional mono eyebrow and actions.
 */
export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {eyebrow || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {eyebrow ? (
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
              <span aria-hidden className="inline-block size-1.5 rounded-full bg-primary" />
              <span className="text-muted-foreground">{eyebrow}</span>
            </p>
          ) : null}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="min-w-0">
        <h1
          className="text-balance text-3xl font-semibold text-foreground sm:text-4xl"
          style={{ letterSpacing: '-0.03em', lineHeight: 1.05 }}
        >
          {title}
        </h1>
      </div>
    </div>
  );
}
