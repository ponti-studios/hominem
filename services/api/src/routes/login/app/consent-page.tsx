// @jsxImportSource react
import {
  AuthAlert,
  AuthCardCopy,
  AuthContent,
  AuthHeading,
  AuthOutlineButton,
  AuthPrimaryButton,
  AuthShell,
  AuthTitle,
} from './auth-shell';

type ConsentPageProps = {
  clientName: string;
  query: string;
  scopes: string[];
  error?: string;
};

export function ConsentPage({ clientName, query, scopes, error }: ConsentPageProps) {
  const groupedScopes = scopes.reduce<Record<string, string[]>>((groups, scope) => {
    const [domain] = scope.split(':');
    (groups[domain ?? 'other'] ??= []).push(scope);
    return groups;
  }, {});

  return (
    <AuthShell
      aside={{
        headline: 'You decide what other apps can see.',
        body: 'Approve only what you recognize. You can deny and nothing is shared.',
      }}
    >
      <AuthContent>
        <AuthHeading>
          <AuthTitle>Authorize {clientName}</AuthTitle>
          <AuthCardCopy>This client is asking for access to your Hominem data.</AuthCardCopy>
        </AuthHeading>
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <div className="flex flex-col rounded-xl border border-auth-border bg-auth-card">
          {Object.entries(groupedScopes).map(([domain, domainScopes]) => {
            const access = (['read', 'write'] as const).filter((level) =>
              domainScopes.some((scope) => scope.endsWith(`:${level}`)),
            );
            return (
              <div
                className="flex items-center gap-3 border-b border-auth-border px-4.5 py-4 text-left last:border-b-0"
                key={domain}
              >
                <span className="text-[15px] font-semibold capitalize text-auth-text">
                  {domain}
                </span>
                <span className="ml-auto flex gap-1.5">
                  {access.map((level) => (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        level === 'read'
                          ? 'bg-[color-mix(in_srgb,var(--auth-primary)_16%,transparent)] text-auth-primary'
                          : 'bg-auth-danger-background text-auth-danger'
                      }`}
                      key={level}
                    >
                      {level}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        <form action="/consent/decision" className="flex flex-col gap-3" method="post">
          <input name="oauth_query" type="hidden" value={query} />
          <AuthPrimaryButton name="accept" type="submit" value="true">
            Approve
          </AuthPrimaryButton>
          <AuthOutlineButton name="accept" type="submit" value="false">
            Deny
          </AuthOutlineButton>
        </form>
      </AuthContent>
    </AuthShell>
  );
}
