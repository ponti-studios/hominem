/**
 * UI shims for components that existed in an older @hominem/ui version
 * but have since been removed or reorganized. These are finance-app-local
 * implementations to unblock the restoration.
 */
import { cn } from '@hominem/ui/lib/utils';
import { type ReactNode, forwardRef } from 'react';
import { useFetcher, useSearchParams } from 'react-router';

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

// ── Label ─────────────────────────────────────────────────────────────────────
export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

// ── Toast (minimal) ───────────────────────────────────────────────────────────
type ToastOptions = { title?: string; description?: string; variant?: 'default' | 'destructive' };
export function toast(options: ToastOptions | string) {
  const msg = typeof options === 'string' ? options : (options.title ?? options.description ?? '');
  console.info('[toast]', msg);
}

// ── Toaster ───────────────────────────────────────────────────────────────────
export function Toaster() {
  return null;
}

// ── NavItem type ──────────────────────────────────────────────────────────────
export interface NavItem {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
}

// ── Header ────────────────────────────────────────────────────────────────────
interface HeaderProps {
  brandName?: string;
  brandIcon?: ReactNode;
  navItems?: NavItem[];
}

export function Header({ brandName, brandIcon, navItems = [] }: HeaderProps) {
  return (
    <nav className="flex items-center gap-4 px-4 py-2 border-b">
      <div className="flex items-center gap-2">
        {brandIcon}
        {brandName && <span className="font-semibold">{brandName}</span>}
      </div>
      <div className="flex items-center gap-2">
        {navItems.map((item) => (
          <a
            key={item.url}
            href={item.url}
            className="flex items-center gap-1 text-sm px-2 py-1 rounded hover:bg-muted"
          >
            {item.icon && <item.icon className="size-4" />}
            {item.title}
          </a>
        ))}
      </div>
    </nav>
  );
}

// ── AppLayout ─────────────────────────────────────────────────────────────────
interface AppLayoutProps {
  navigation?: ReactNode;
  children: ReactNode;
}

export function AppLayout({ navigation, children }: AppLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {navigation}
      <main className="flex-1">{children}</main>
    </div>
  );
}

// ── AuthRouteLayout ───────────────────────────────────────────────────────────
export function AuthRouteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">{children}</div>
    </div>
  );
}

// ── LandingPage ───────────────────────────────────────────────────────────────
interface Feature {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}
interface Step {
  label: string;
  description: string;
}
interface LandingPageProps {
  kicker?: string;
  headline: string;
  sub?: string;
  ctaPrimary?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  problem?: string;
  features?: Feature[];
  steps?: Step[];
  trustSignal?: string;
}

export function LandingPage({
  headline,
  sub,
  ctaPrimary,
  ctaSecondary,
  features = [],
  trustSignal,
}: LandingPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 text-center">
      <h1 className="text-4xl font-bold">{headline}</h1>
      {sub && <p className="text-xl text-muted-foreground max-w-xl">{sub}</p>}
      <div className="flex gap-4">
        {ctaPrimary && (
          <a
            href={ctaPrimary.href}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            {ctaPrimary.label}
          </a>
        )}
        {ctaSecondary && (
          <a href={ctaSecondary.href} className="px-6 py-2 border rounded-lg">
            {ctaSecondary.label}
          </a>
        )}
      </div>
      {features.length > 0 && (
        <div className="grid grid-cols-2 gap-6 max-w-2xl">
          {features.map((f) => (
            <div key={f.title} className="text-left">
              {f.icon && <f.icon className="size-5 mb-1" />}
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      )}
      {trustSignal && <p className="text-sm text-muted-foreground">{trustSignal}</p>}
    </div>
  );
}

// ── PasskeyEnrollmentBanner ───────────────────────────────────────────────────
export function PasskeyEnrollmentBanner({
  onEnroll: _onEnroll,
}: {
  onEnroll?: () => Promise<void> | void;
}) {
  return null;
}

// ── usePasskeyAuth ────────────────────────────────────────────────────────────
export function usePasskeyAuth() {
  return {
    register: async (): Promise<boolean> => false,
    authenticate: async () => {},
    deletePasskey: async (_id: string): Promise<boolean> => false,
    isSupported: false,
  };
}

// ── createAuthEntryComponent / createAuthVerifyComponent ─────────────────────
export function createAuthEntryComponent(_config: object) {
  return function AuthEntryPage() {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Sign in</h2>
        <form method="post" className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            placeholder="Email"
            aria-label="Email address"
            className="border rounded px-3 py-2"
            required
          />
          <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded">
            Continue
          </button>
        </form>
      </div>
    );
  };
}

export function createAuthVerifyComponent(_config: object) {
  return function AuthVerifyPage() {
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') ?? '';
    const fetcher = useFetcher<{ error?: string }>();
    const actionData = fetcher.data;
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Enter code</h2>
        <fetcher.Form method="post" className="flex flex-col gap-3">
          <input type="hidden" name="email" value={email} />
          <input
            name="otp"
            type="text"
            placeholder="6-digit code"
            aria-label="Verification code"
            className="border rounded px-3 py-2"
            required
          />
          <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded">
            Verify
          </button>
        </fetcher.Form>
        {actionData?.error && (
          <p className="text-red-600 text-sm">
            Verification failed. Please check your code and try again.
          </p>
        )}
      </div>
    );
  };
}

// ── useSort ───────────────────────────────────────────────────────────────────
import { useState } from 'react';

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

interface UseSortOptions {
  initialSortOptions?: SortOption[];
}

export function useSort(options: UseSortOptions = {}) {
  const [sortOptions, setSortOptions] = useState<SortOption[]>(options.initialSortOptions ?? []);
  return {
    sortOptions,
    addSortOption: (opt: SortOption) => setSortOptions((prev) => [...prev, opt]),
    updateSortOption: (index: number, opt: SortOption) =>
      setSortOptions((prev) => prev.map((o, i) => (i === index ? opt : o))),
    removeSortOption: (index: number) =>
      setSortOptions((prev) => prev.filter((_, i) => i !== index)),
  };
}

// ── SearchInput ───────────────────────────────────────────────────────────────
export const SearchInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="search"
    className={cn(
      'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
      className,
    )}
    {...props}
  />
));
SearchInput.displayName = 'SearchInput';
