import type { ResumeMode } from '../helpers';
import { PageFrame } from './page-frame';
import { authErrorPage, pageFrame } from './styles.generated';

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
    <PageFrame>
      <div class={pageFrame.authContent}>
        <div aria-hidden="true" class={authErrorPage.errorSymbol}>
          !
        </div>
        <div class={pageFrame.authHeading}>
          <p class={authErrorPage.secureLabel}>{accessLabel}</p>
          <h2 id="error-title">Authorization stopped</h2>
          <p class={pageFrame.cardCopy}>
            {description ?? (error ? `The request ended with ${error}.` : null) ?? returnCopy}
          </p>
        </div>
      </div>
    </PageFrame>
  );
}
