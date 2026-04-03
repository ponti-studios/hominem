import * as React from 'react';

interface AuthScaffoldProps {
  children: React.ReactNode;
  title: string;
  helper?: string;
  logo?: string;
  className?: string;
}

export function AuthScaffold({ children, title, helper, logo, className }: AuthScaffoldProps) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-base px-4 py-10 ${className ?? ''}`}
    >
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex items-center gap-2">
          {logo ? (
            <img src={logo} alt="" className="h-14 w-14 rounded-2xl object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-2xl border border-default bg-elevated" />
          )}
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent/30 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="heading-2 text-text-primary">{title}</h1>
          {helper ? <p className="body-3 text-text-secondary">{helper}</p> : null}
        </div>

        <div className="mt-6 w-full text-left">{children}</div>
      </div>
    </div>
  );
}
