import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '~/components/ui/button';

import { SectionCard } from './surfaces';

/**
 * Back navigation. Text link by default; icon-button variant for headers
 * that already carry their own title.
 */
export function BackLink({
  to,
  label,
  variant = 'link',
}: {
  to: string;
  label: string;
  variant?: 'link' | 'icon';
}) {
  if (variant === 'icon') {
    return (
      <Button aria-label={label} asChild size="icon-sm" variant="ghost">
        <Link to={to} viewTransition>
          <ArrowLeft />
        </Link>
      </Button>
    );
  }
  return (
    <Link
      to={to}
      viewTransition
      className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-[#9ba3b4] uppercase transition-colors hover:text-[#f2f4f8]"
    >
      <ArrowLeft aria-hidden className="size-3.5" />
      {label}
    </Link>
  );
}

type DetailHeroProps = {
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
};

/** Detail page hero: title, subtitle, action buttons, status badges. */
export function DetailHero({ title, subtitle, badges, actions }: DetailHeroProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-balance text-3xl font-semibold text-[#f2f4f8] sm:text-4xl"
            style={{ letterSpacing: '-0.03em', lineHeight: 1.05 }}
          >
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-lg text-[#9ba3b4]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
    </div>
  );
}

type DetailSectionProps = {
  title: string;
  children: React.ReactNode;
  index?: number;
};

/** Card section with an eyebrow title. Replaces every `cardClass` block. */
export function DetailSection({ title, children, index = 0 }: DetailSectionProps) {
  return (
    <SectionCard index={index}>
      <div className="p-5 sm:p-6">
        <h2 className="mb-4 font-mono text-[11px] tracking-[0.16em] text-[#9ba3b4] uppercase">
          {title}
        </h2>
        {children}
      </div>
    </SectionCard>
  );
}

type DetailFieldProps = {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
};

/** Label/value fact. Renders nothing when the value is empty. */
export function DetailField({ label, value, mono }: DetailFieldProps) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] tracking-[0.14em] text-[#5e6678] uppercase">{label}</p>
      <p className={mono ? 'mt-1 font-mono text-sm text-[#f2f4f8]' : 'mt-1 text-sm text-[#f2f4f8]'}>
        {value}
      </p>
    </div>
  );
}
