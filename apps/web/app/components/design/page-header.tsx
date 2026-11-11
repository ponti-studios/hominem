import { motion } from 'motion/react';

/**
 * Shared page hero. Every domain page gets the same editorial composition:
 * mono eyebrow, display title, supporting line, optional actions.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
      initial={{ opacity: 0, y: 12 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-primary" />
          <span className="text-muted-foreground">{eyebrow}</span>
        </p>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="min-w-0">
        <h1
          className="text-balance text-3xl font-semibold text-foreground sm:text-4xl"
          style={{ letterSpacing: '-0.03em', lineHeight: 1.05 }}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
