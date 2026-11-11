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
      className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-foreground"
    >
      <ArrowLeft aria-hidden className="size-3.5" />
      {label}
    </Link>
  );
}

type DetailHeroProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  back?: React.ReactNode;
  actions?: React.ReactNode;
};

/** Detail route header: eyebrow and actions on one line, title and status below. */
export function DetailHero({ eyebrow, title, subtitle, badges, back, actions }: DetailHeroProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {back}
          <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
            <span aria-hidden className="inline-block size-1.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">{eyebrow}</span>
          </p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <h1
        className="text-balance text-3xl font-semibold text-foreground sm:text-4xl"
        style={{ letterSpacing: '-0.03em', lineHeight: 1.05 }}
      >
        {title}
      </h1>
      {subtitle ? <p className="mt-1 text-lg text-muted-foreground">{subtitle}</p> : null}
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
        <h2 className="mb-4 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
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
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={mono ? 'mt-1 font-mono text-sm text-foreground' : 'mt-1 text-sm text-foreground'}
      >
        {value}
      </p>
    </div>
  );
}
