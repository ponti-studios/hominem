// @jsxImportSource react
import {
  AuthCardCopy,
  AuthContent,
  AuthHeading,
  AuthPrimaryButton,
  AuthSecondaryLink,
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
          <AuthTitle>{signedOut ? "You're signed out" : 'Sign out?'}</AuthTitle>
          <AuthCardCopy>
            {signedOut
              ? 'Your session on every Hominem app has ended. Nothing else changed.'
              : 'This clears your Hominem browser session.'}
          </AuthCardCopy>
        </AuthHeading>
        {signedOut ? (
          <div className="flex flex-col items-center gap-3.5">
            <a
              className="grid h-12 w-full place-items-center rounded-[10px] bg-auth-primary text-base font-semibold text-auth-primary-text no-underline transition-opacity duration-150 hover:opacity-90"
              href={`/login?next=${encodeURIComponent(`${window.location.origin}/auth/settings`)}`}
            >
              Sign in again
            </a>
            <AuthSecondaryLink href="https://hominem.app">Back to Hominem</AuthSecondaryLink>
          </div>
        ) : (
          <form action="/logout" method="post">
            <AuthPrimaryButton type="submit">Sign me out</AuthPrimaryButton>
          </form>
        )}
      </AuthContent>
    </AuthShell>
  );
}
