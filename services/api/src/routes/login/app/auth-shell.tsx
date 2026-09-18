// @jsxImportSource react
import type { ReactNode } from 'react';

import styles from './auth-shell.module.css';

type AuthShellProps = {
  children: ReactNode;
  wide?: boolean;
};

export function AuthShell({ children, wide = false }: AuthShellProps) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-clip bg-auth-background px-4 py-16 text-auth-text">
      <div aria-hidden="true" className={styles.authGrid} />
      <div
        className={`relative flex w-full flex-col items-center gap-6 ${wide ? 'max-w-4xl' : 'max-w-xl'}`}
      >
        <a
          aria-label="Hominem"
          className="inline-flex items-center gap-2 text-[15px] font-semibold text-auth-text no-underline hover:opacity-85"
          href="https://hominem.app"
        >
          <img
            alt=""
            className="block rounded-md"
            height="28"
            src="/logo.hominem.500x500.webp"
            width="28"
          />
          <span>Hominem</span>
        </a>
        <section
          className={`w-full rounded-lg border border-auth-border bg-auth-card p-10 text-auth-text shadow-[0_10px_25px_rgba(0,0,0,0.08)] max-sm:p-8 ${styles.authCard}`}
        >
          {children}
        </section>
      </div>
    </div>
  );
}

type AuthHeadingProps = {
  children: ReactNode;
};

export function AuthHeading({ children }: AuthHeadingProps) {
  return <div className="flex flex-col gap-2 text-left">{children}</div>;
}

type AuthCardCopyProps = {
  children: ReactNode;
};

export function AuthCardCopy({ children }: AuthCardCopyProps) {
  return <p className="m-0 text-sm leading-[1.55] text-auth-muted">{children}</p>;
}

type AuthContentProps = {
  children: ReactNode;
  wide?: boolean;
};

export function AuthContent({ children, wide = false }: AuthContentProps) {
  return (
    <div
      className={`mx-auto flex w-full max-w-md flex-col gap-4 text-center ${wide ? 'max-w-4xl' : ''}`}
    >
      {children}
    </div>
  );
}

export function AuthTitle({ children }: AuthCardCopyProps) {
  return <h2 className="m-0 text-3xl font-semibold text-auth-text">{children}</h2>;
}

export function AuthAlert({ children }: AuthCardCopyProps) {
  return (
    <p
      className={`m-0 rounded-md border border-[color-mix(in_srgb,var(--auth-danger)_35%,transparent)] bg-auth-danger-background px-3.5 py-3 text-[13px] leading-[1.45] text-auth-danger ${styles.alert}`}
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
};

export function AuthField({ children, label }: AuthFieldProps) {
  return (
    <div className="grid gap-1.5 text-left">
      <label className="text-xs font-medium text-auth-text">{label}</label>
      {children}
    </div>
  );
}

const inputClassName =
  'w-full min-h-9 rounded-md border border-auth-border bg-auth-panel px-3 text-auth-text shadow-[0_0_0_0_var(--auth-border)] outline-none transition-[border-color,background,box-shadow] duration-200 focus:border-auth-primary focus:bg-auth-card focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--auth-primary)_12%,transparent)]';

export function AuthTextInput(props: {
  autoComplete?: string;
  autoFocus?: boolean;
  id?: string;
  name?: string;
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
      className="mt-3 min-h-9 w-full cursor-pointer rounded-md border-0 bg-auth-primary font-semibold text-auth-primary-text transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.98]"
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
