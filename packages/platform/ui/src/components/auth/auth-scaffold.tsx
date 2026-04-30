import * as React from 'react';

interface AuthScaffoldProps {
  children: React.ReactNode;
  title: string;
  helperText?: string;
  className?: string;
}

export function AuthScaffold({ children, title, helperText, className }: AuthScaffoldProps) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-base px-4 py-10 ${className ?? ''}`}
    >
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <div className="space-y-1">
          <h1 className="heading-2 text-text-primary">{title}</h1>
          {helperText ? <p className="text-sm text-text-secondary">{helperText}</p> : null}
        </div>

        <div className="mt-6 w-full text-left">{children}</div>
      </div>
    </div>
  );
}
