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
    <AuthShell
      aside={{
        headline: 'Nothing was shared.',
        body: 'When authorization stops, no access is granted and nothing changes on your account.',
      }}
    >
      <AuthContent>
        <svg aria-hidden="true" fill="none" height="44" viewBox="0 0 44 44" width="44">
          <circle cx="22" cy="22" r="20" stroke="var(--auth-danger)" strokeWidth="2" />
          <path d="M22 12v13" stroke="var(--auth-danger)" strokeLinecap="round" strokeWidth="2.5" />
          <circle cx="22" cy="32" fill="var(--auth-danger)" r="1.8" />
        </svg>
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
