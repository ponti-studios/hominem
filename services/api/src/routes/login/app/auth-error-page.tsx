// @jsxImportSource react
import { AuthCardCopy, AuthContent, AuthHeading, AuthShell, AuthTitle } from './auth-shell';
import type { ResumeMode } from './init';

type AuthErrorPageProps = {
  description?: string;
  error?: string;
  mode?: ResumeMode;
};

export function AuthErrorPage({ description, error, mode }: AuthErrorPageProps) {
  const isAppMode = mode === 'app' || mode === 'oauth';
  const accessLabel = isAppMode ? 'App access' : 'OAuth access';
  const returnCopy = isAppMode
    ? 'Return to the app you came from and try again.'
    : 'Return to your MCP client and try again.';

  return (
    <AuthShell>
      <AuthContent>
        <div
          aria-hidden="true"
          className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[color-mix(in_srgb,var(--auth-danger)_35%,transparent)] bg-auth-danger-background text-2xl font-bold text-auth-danger"
        >
          !
        </div>
        <AuthHeading>
          <p className="m-0 text-xs font-semibold uppercase tracking-wider text-auth-muted">
            {accessLabel}
          </p>
          <AuthTitle>Authorization stopped</AuthTitle>
          <AuthCardCopy>
            {description ?? (error ? `The request ended with ${error}.` : null) ?? returnCopy}
          </AuthCardCopy>
        </AuthHeading>
      </AuthContent>
    </AuthShell>
  );
}
