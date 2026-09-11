import { PageFrame } from './page-frame';
import { consentPage, pageFrame, shared } from './styles.generated';

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
    <PageFrame title="Authorize access | Hominem">
      <div class={pageFrame.authContent}>
        <div class={pageFrame.authHeading}>
          <h2 id="consent-title">Authorize {clientName}</h2>
          <p class={pageFrame.cardCopy}>This client is requesting access to your Hominem data.</p>
        </div>
        {error ? (
          <p class={pageFrame.alert} role="alert">
            {error}
          </p>
        ) : null}
        <div class={shared.field}>
          <label>Requested permissions</label>
          <div class={consentPage.scopeList}>
            {Object.entries(groupedScopes).map(([domain, domainScopes]) => {
              const access = (['read', 'write'] as const).filter((level) =>
                domainScopes.some((scope) => scope.endsWith(`:${level}`)),
              );
              return (
                <div key={domain} class={consentPage.scopeRow}>
                  <span aria-hidden="true" class={consentPage.scopeIcon}>
                    {domain.charAt(0).toUpperCase()}
                  </span>
                  <span class={consentPage.scopeName}>{domain}</span>
                  <span class={consentPage.scopeBadges}>
                    {access.map((level) => (
                      <span
                        class={consentPage[level === 'read' ? 'scopeBadgeRead' : 'scopeBadgeWrite']}
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
        </div>
        <form action="/consent/decision" method="post">
          <input name="oauth_query" type="hidden" value={query} />
          <button class={shared.primaryButton} name="accept" type="submit" value="true">
            Approve
          </button>
          <button class={shared.secondaryButton} name="accept" type="submit" value="false">
            Deny
          </button>
        </form>
      </div>
    </PageFrame>
  );
}
