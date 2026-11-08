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
  accent = '#d7ff3e',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  accent?: string;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
      initial={{ opacity: 0, y: 12 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
        <span
          aria-hidden
          className="inline-block size-1.5 rounded-full"
          style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
        />
        <span className="text-[#9ba3b4]">{eyebrow}</span>
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-balance text-3xl font-semibold text-[#f2f4f8] sm:text-4xl"
            style={{ letterSpacing: '-0.03em', lineHeight: 1.05 }}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[#9ba3b4]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </motion.div>
  );
}
