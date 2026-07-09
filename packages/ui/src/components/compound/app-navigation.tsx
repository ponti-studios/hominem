import * as React from 'react';

export interface AppNavigationLink {
  href: string;
  label: string;
  /** Optional icon. Used when `linksDisplay` is `"icon"`, or shown before the label when `"label"`. */
  icon?: React.ReactNode;
}

export interface AppNavigationCta {
  href: string;
  label: string;
  variant?: 'default' | 'outline';
  icon?: React.ReactNode;
}

export interface AppNavigationRenderLinkArgs {
  href: string;
  className: string;
  children: React.ReactNode;
  onClick?: () => void;
  /** Accessible name when the visible content is icon-only. */
  'aria-label'?: string;
  title?: string;
}

export interface AppNavigationProps {
  brand?: React.ReactNode;
  brandHref?: string;
  links?: AppNavigationLink[];
  cta?: AppNavigationCta;
  /** Current pathname used to highlight the active link. */
  activeHref?: string;
  /**
   * How links are rendered.
   * - `"label"` — text pills (default), optional icon prefix
   * - `"icon"` — icon-only circular buttons; `label` is used for a11y
   */
  linksDisplay?: 'label' | 'icon';
  navHeight?: number;
  renderLink: (args: AppNavigationRenderLinkArgs) => React.ReactNode;
}

export function AppNavigation({
  brand,
  brandHref = '/',
  links,
  cta,
  activeHref,
  linksDisplay = 'label',
  renderLink,
}: AppNavigationProps) {
  const isActive = (href: string) => {
    if (!activeHref) return false;
    if (href === activeHref) return true;
    // Nested routes (e.g. /work/123) keep the parent link active.
    return href !== '/' && activeHref.startsWith(`${href}/`);
  };

  const iconOnly = linksDisplay === 'icon';

  const linkClassName = (href: string) =>
    iconOnly
      ? `inline-flex size-9 items-center justify-center rounded-full transition-colors ${
          isActive(href)
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      : `inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${
          isActive(href)
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`;

  const ctaClassName = () => {
    if (iconOnly && cta?.icon) {
      return `ml-1 inline-flex size-9 items-center justify-center rounded-full transition-colors ${
        cta.variant === 'outline'
          ? 'border border-border text-foreground hover:bg-muted'
          : isActive(cta.href)
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`;
    }

    return `ml-1 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${
      cta?.variant === 'outline'
        ? 'border border-border text-foreground hover:bg-accent'
        : isActive(cta!.href)
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground'
    }`;
  };

  return (
    <div className="bg-background/80 sticky top-0 z-50 flex w-full justify-center px-2 py-2 backdrop-blur-sm backdrop-saturate-150 md:px-0">
      <nav className="flex w-full max-w-7xl items-center justify-between py-2">
        {brand &&
          renderLink({
            href: brandHref,
            className: 'font-semibold text-sm tracking-tight text-foreground',
            children: brand,
          })}

        <div className="flex items-center gap-1">
          {links?.map((link) => {
            const showIconOnly = iconOnly && link.icon;
            return renderLink({
              href: link.href,
              className: linkClassName(link.href),
              'aria-label': showIconOnly ? link.label : undefined,
              title: showIconOnly ? link.label : undefined,
              children: showIconOnly ? (
                link.icon
              ) : (
                <>
                  {link.icon}
                  <span>{link.label}</span>
                </>
              ),
            });
          })}
          {cta &&
            renderLink({
              href: cta.href,
              className: ctaClassName(),
              'aria-label': iconOnly && cta.icon ? cta.label : undefined,
              title: iconOnly && cta.icon ? cta.label : undefined,
              children:
                iconOnly && cta.icon ? (
                  cta.icon
                ) : (
                  <>
                    {cta.icon}
                    <span>{cta.label}</span>
                  </>
                ),
            })}
        </div>
      </nav>
    </div>
  );
}
