import * as React from "react";

export interface AppNavigationLink {
  href: string;
  label: string;
}

export interface AppNavigationCta {
  href: string;
  label: string;
  variant?: "default" | "outline";
}

export interface AppNavigationRenderLinkArgs {
  href: string;
  className: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export interface AppNavigationProps {
  brand?: React.ReactNode;
  brandHref?: string;
  links?: AppNavigationLink[];
  cta?: AppNavigationCta;
  /** Current pathname used to highlight the active link. */
  activeHref?: string;
  navHeight?: number;
  renderLink: (args: AppNavigationRenderLinkArgs) => React.ReactNode;
}

export function AppNavigation({
  brand,
  brandHref = "/",
  links,
  cta,
  activeHref,
  renderLink,
}: AppNavigationProps) {
  const isActive = (href: string) => href === activeHref;

  return (
    <div className="bg-background/80 sticky top-0 z-50 flex w-full justify-center px-2 py-2 backdrop-blur-sm backdrop-saturate-150 md:px-0">
      <nav className="flex w-full max-w-7xl items-center justify-between py-2">
        {brand &&
          renderLink({
            href: brandHref,
            className: "font-semibold text-sm tracking-tight text-foreground",
            children: brand,
          })}

        <div className="flex items-center gap-1">
          {links?.map((link) =>
            renderLink({
              href: link.href,
              className: `px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${
                isActive(link.href)
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`,
              children: link.label,
            }),
          )}
          {cta &&
            renderLink({
              href: cta.href,
              className: `ml-1 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${
                cta.variant === "outline"
                  ? "border border-border text-foreground hover:bg-accent"
                  : isActive(cta.href)
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
              }`,
              children: cta.label,
            })}
        </div>
      </nav>
    </div>
  );
}
