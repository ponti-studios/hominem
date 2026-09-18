// @jsxImportSource react
import {
  AuthCardCopy,
  AuthContent,
  AuthHeading,
  AuthPrimaryButton,
  AuthShell,
  AuthTitle,
} from './auth-shell';

type LogoutPageProps = {
  signedOut?: boolean;
};

export function LogoutPage({ signedOut = false }: LogoutPageProps) {
  return (
    <AuthShell>
      <AuthContent>
        <AuthHeading>
          <AuthTitle>{signedOut ? 'Signed out' : 'Sign out?'}</AuthTitle>
          <AuthCardCopy>
            {signedOut
              ? 'Your browser session has been cleared.'
              : 'This clears your Hominem browser session.'}
          </AuthCardCopy>
          {signedOut ? (
            <AuthCardCopy>Start a new sign-in from the app or client you came from.</AuthCardCopy>
          ) : null}
        </AuthHeading>
        {signedOut ? null : (
          <form action="/logout" method="post">
            <AuthPrimaryButton type="submit">Sign me out</AuthPrimaryButton>
          </form>
        )}
      </AuthContent>
    </AuthShell>
  );
}
