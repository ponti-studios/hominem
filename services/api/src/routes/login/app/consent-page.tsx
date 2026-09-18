// @jsxImportSource react
import {
  AuthAlert,
  AuthCardCopy,
  AuthContent,
  AuthField,
  AuthHeading,
  AuthPrimaryButton,
  AuthSecondaryButton,
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
    <AuthShell>
      <AuthContent>
        <AuthHeading>
          <AuthTitle>Authorize {clientName}</AuthTitle>
          <AuthCardCopy>This client is requesting access to your Hominem data.</AuthCardCopy>
        </AuthHeading>
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <AuthField label="Requested permissions">
          <div className="flex flex-col gap-2">
            {Object.entries(groupedScopes).map(([domain, domainScopes]) => {
              const access = (['read', 'write'] as const).filter((level) =>
                domainScopes.some((scope) => scope.endsWith(`:${level}`)),
              );
              return (
                <div
                  className="flex items-center gap-3 rounded-lg border border-auth-border bg-auth-panel p-2.5 text-left"
                  key={domain}
                >
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-auth-primary font-bold text-auth-primary-text"
                  >
                    {domain.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold text-auth-text">{domain}</span>
                  <span className="ml-auto flex gap-1.5">
                    {access.map((level) => (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                          level === 'read'
                            ? 'bg-[color-mix(in_srgb,var(--auth-primary)_10%,transparent)] text-auth-primary'
                            : 'bg-[color-mix(in_srgb,var(--auth-danger)_12%,transparent)] text-auth-danger'
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
        </AuthField>
        <form action="/consent/decision" method="post">
          <input name="oauth_query" type="hidden" value={query} />
          <AuthPrimaryButton name="accept" type="submit" value="true">
            Approve
          </AuthPrimaryButton>
          <div className="mt-4">
            <AuthSecondaryButton name="accept" type="submit" value="false">
              Deny
            </AuthSecondaryButton>
          </div>
        </form>
      </AuthContent>
    </AuthShell>
  );
}
