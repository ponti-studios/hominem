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
        {logo ? <img src={logo} alt={title} className="mb-4 h-10 w-10" /> : null}
        <div className="space-y-1">
          <h2 className="heading-3 text-text-primary">{title}</h2>
          {helper ? <h1 className="heading-2 text-text-primary">{helper}</h1> : null}
        </div>

        <div className="mt-6 w-full text-left">{children}</div>
      </div>
    </div>
  );
}
