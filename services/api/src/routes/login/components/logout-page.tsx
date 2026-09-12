import { pageFrame, shared } from '../styles';
import { PageFrame } from './page-frame';

export function LogoutPage({ signedOut = false }: { signedOut?: boolean } = {}) {
  return (
    <PageFrame title="Sign out | Hominem">
      <div class={pageFrame.authContent}>
        <div class={pageFrame.authHeading}>
          <h2 id="logout-title">{signedOut ? 'Signed out' : 'Sign out?'}</h2>
          <p class={pageFrame.cardCopy}>
            {signedOut
              ? 'Your browser session has been cleared.'
              : 'This clears your Hominem browser session.'}
          </p>
          {signedOut ? (
            <p class={pageFrame.cardCopy}>
              Start a new sign-in from the app or client you came from.
            </p>
          ) : null}
        </div>
        {signedOut ? null : (
          <form action="/logout" method="post">
            <button class={shared.primaryButton} type="submit">
              Sign me out
            </button>
          </form>
        )}
      </div>
    </PageFrame>
  );
}
