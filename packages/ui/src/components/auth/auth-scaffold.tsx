import type { ReactNode } from "react";

export interface AuthScaffoldProps {
  children: ReactNode;
  title: string;
  helperText?: string;
}

export function AuthScaffold({ children, title, helperText }: AuthScaffoldProps) {
  return (
    <div className="bg-base flex items-center justify-center px-4 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <div className="space-y-2">
          <h1 className="heading-2 text-text-primary">{title}</h1>
          {helperText ? <p className="callout text-text-secondary">{helperText}</p> : null}
        </div>

        <div className="mt-6 w-full text-left">{children}</div>
      </div>
    </div>
  );
}
