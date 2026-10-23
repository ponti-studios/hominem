// @jsxImportSource react
import type { ReactNode } from 'react';

import styles from './auth-shell.module.css';

export type AuthAside = {
  headline: string;
  body: string;
  /** Small line pinned to the bottom of the panel; defaults to the current host. */
  footer?: string;
};

const DEFAULT_ASIDE: AuthAside = {
  headline: "One quiet place for the things you're keeping track of.",
  body: 'Notes, tasks and conversations, together. Sign in once and every Hominem app knows who you are.',
};

type AuthShellProps = {
  children: ReactNode;
  /** Wide pages (usage tables) keep a single centered card instead of the split layout. */
  wide?: boolean;
  /** No card, logo or grid: the page draws its own surface (the account page). */
  bare?: boolean;
  aside?: AuthAside;
};

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <a
      aria-label="Hominem"
      className={`inline-flex items-center gap-3 text-[17px] font-semibold tracking-tight text-auth-text no-underline hover:opacity-85 ${className}`}
      href="https://hominem.app"
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-[10px] bg-auth-text font-display text-[22px] leading-none text-auth-background"
      >
        h
      </span>
      <span>Hominem</span>
    </a>
  );
}

export function AuthShell({ children, wide = false, bare = false, aside }: AuthShellProps) {
  if (bare) {
    return (
      <div className="relative min-h-dvh bg-auth-background px-4 py-10 text-auth-text max-sm:py-6">
        {children}
      </div>
    );
  }
  if (wide) {
    return (
      <div className="relative grid min-h-dvh place-items-center overflow-clip bg-auth-background px-4 py-16 text-auth-text">
        <div aria-hidden="true" className={styles.authGrid} />
        <div className="relative flex w-full max-w-4xl flex-col items-center gap-6">
          <BrandMark />
          <section
            className={`w-full rounded-lg border border-auth-border bg-auth-card p-10 text-auth-text shadow-[0_10px_25px_rgba(0,0,0,0.08)] max-sm:p-8 ${styles.authCard}`}
          >
            {children}
          </section>
        </div>
      </div>
    );
  }

  const copy = aside ?? DEFAULT_ASIDE;
  return (
    <div className="min-h-dvh bg-auth-background text-auth-text lg:grid lg:grid-cols-[minmax(360px,520px)_1fr]">
      <aside className="hidden flex-col justify-between bg-auth-panel p-14 lg:flex">
        <BrandMark />
        <div className="flex flex-col gap-5">
          <h2 className="m-0 font-display text-[52px] font-normal leading-[1.08] tracking-[-0.02em]">
            {copy.headline}
          </h2>
          <p className="m-0 max-w-sm text-base leading-relaxed text-auth-muted">{copy.body}</p>
        </div>
        <p className="m-0 text-[13px] text-auth-muted">{copy.footer ?? window.location.host}</p>
      </aside>
      <main className="flex min-h-dvh flex-col px-6 pb-8 pt-7 lg:items-center lg:justify-center lg:p-14">
        <BrandMark className="lg:hidden" />
        <div className="flex w-full max-w-[400px] flex-1 flex-col justify-center lg:flex-none">
          {children}
        </div>
        <p className="m-0 text-[13px] text-auth-muted lg:hidden">{window.location.host}</p>
      </main>
    </div>
  );
}

type AuthHeadingProps = {
  children: ReactNode;
};

export function AuthHeading({ children }: AuthHeadingProps) {
  return <div className="flex flex-col gap-2.5 text-left">{children}</div>;
}

type AuthCardCopyProps = {
  children: ReactNode;
};

export function AuthCardCopy({ children }: AuthCardCopyProps) {
  return <p className="m-0 text-[15px] leading-[1.55] text-auth-muted">{children}</p>;
}

type AuthContentProps = {
  children: ReactNode;
  wide?: boolean;
};

export function AuthContent({ children, wide = false }: AuthContentProps) {
  return (
    <div
      className={`mx-auto flex w-full flex-col gap-7 text-left ${wide ? 'max-w-4xl' : 'max-w-[400px]'}`}
    >
      {children}
    </div>
  );
}

export function AuthTitle({ children }: AuthCardCopyProps) {
  return (
    <h1 className="m-0 font-display text-4xl font-medium tracking-[-0.02em] text-auth-text">
      {children}
    </h1>
  );
}

export function AuthAlert({ children }: AuthCardCopyProps) {
  return (
    <p
      className={`m-0 rounded-[10px] border border-[color-mix(in_srgb,var(--auth-danger)_35%,transparent)] bg-auth-danger-background px-3.5 py-3 text-sm leading-[1.45] text-auth-danger ${styles.alert}`}
      aria-live="polite"
      role="alert"
    >
      {children}
    </p>
  );
}

type AuthFieldProps = {
  children: ReactNode;
  label: string;
  htmlFor?: string;
};

export function AuthField({ children, label, htmlFor }: AuthFieldProps) {
  return (
    <div className="grid gap-2 text-left">
      <label className="text-[13px] font-medium text-auth-text" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClassName =
  'h-12 w-full rounded-[10px] border border-auth-border bg-auth-card px-3.5 text-base text-auth-text outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-auth-muted focus:border-auth-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--auth-primary)_22%,transparent)]';

export function AuthTextInput(props: {
  autoComplete?: string;
  autoFocus?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  ref?: React.Ref<HTMLInputElement>;
  required?: boolean;
  type?: 'text' | 'email';
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <input
      autoComplete={props.autoComplete}
      autoFocus={props.autoFocus}
      className={inputClassName}
      id={props.id}
      name={props.name}
      placeholder={props.placeholder}
      onChange={props.onChange ? (event) => props.onChange?.(event.target.value) : undefined}
      ref={props.ref}
      required={props.required}
      type={props.type ?? 'text'}
      value={props.value}
    />
  );
}

export function AuthPrimaryButton(props: {
  children: ReactNode;
  name?: string;
  type?: 'submit' | 'button';
  value?: string;
}) {
  return (
    <button
      className="h-12 w-full cursor-pointer rounded-[10px] border-0 bg-auth-primary text-base font-semibold text-auth-primary-text transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.98]"
      name={props.name}
      type={props.type ?? 'submit'}
      value={props.value}
    >
      {props.children}
    </button>
  );
}

export function AuthOutlineButton(props: {
  children: ReactNode;
  name?: string;
  type?: 'submit' | 'button';
  value?: string;
}) {
  return (
    <button
      className="h-12 w-full cursor-pointer rounded-[10px] border border-auth-border bg-transparent text-base font-medium text-auth-text transition-[transform,background-color] duration-150 hover:bg-auth-panel active:scale-[0.98]"
      name={props.name}
      type={props.type ?? 'submit'}
      value={props.value}
    >
      {props.children}
    </button>
  );
}

export function AuthSecondaryLink(props: { children: ReactNode; href: string }) {
  return (
    <a
      className="m-0 cursor-pointer bg-transparent p-0 text-sm font-medium text-auth-primary no-underline transition-opacity duration-150 hover:underline hover:underline-offset-3 active:opacity-70"
      href={props.href}
    >
      {props.children}
    </a>
  );
}

export function AuthSecondaryButton(props: {
  children: ReactNode;
  name?: string;
  type?: 'submit' | 'button';
  value?: string;
}) {
  return (
    <button
      className="m-0 cursor-pointer bg-transparent p-0 text-sm font-medium text-auth-primary no-underline transition-opacity duration-150 hover:underline hover:underline-offset-3 active:opacity-70"
      name={props.name}
      type={props.type ?? 'submit'}
      value={props.value}
    >
      {props.children}
    </button>
  );
}

// Kept for the settings "Sign out" danger button and similar destructive rows.
export function AuthDangerButton(props: { children: ReactNode; type?: 'submit' | 'button' }) {
  return (
    <button
      className="m-0 w-full cursor-pointer rounded-lg border border-[color-mix(in_srgb,var(--auth-danger)_35%,transparent)] bg-transparent p-3 text-left text-sm font-semibold text-auth-danger transition-colors duration-150 hover:bg-auth-danger-background"
      type={props.type ?? 'submit'}
    >
      {props.children}
    </button>
  );
}
