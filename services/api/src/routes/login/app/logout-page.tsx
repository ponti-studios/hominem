// @jsxImportSource react
import { useEffect, useRef } from 'react';

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
  next?: string;
};

export function LogoutPage({ signedOut = false, next }: LogoutPageProps) {
  const formRef = useRef<HTMLFormElement | null>(null);

  // Arrived from an app with a return target: sign out right away.
  useEffect(() => {
    if (next) formRef.current?.requestSubmit();
  }, [next]);

  return (
    <AuthShell>
      <AuthContent>
        <AuthHeading>
          <AuthTitle>{signedOut ? "You're signed out" : 'Sign out?'}</AuthTitle>
          <AuthCardCopy>
            {signedOut
              ? 'Your Hominem session in this browser has ended. Nothing else changed.'
              : 'This clears your Hominem browser session.'}
          </AuthCardCopy>
        </AuthHeading>
        {signedOut ? (
          <div className="flex flex-col items-center gap-3.5">
            <a
              className="grid h-12 w-full place-items-center rounded-[10px] bg-auth-primary text-base font-semibold text-auth-primary-text no-underline transition-opacity duration-150 hover:opacity-90"
              href={`/login?next=${encodeURIComponent(`${window.location.origin}/account`)}`}
            >
              Sign in again
            </a>
            <AuthSecondaryLink href="https://hominem.app">Back to Hominem</AuthSecondaryLink>
          </div>
        ) : (
          <form action="/logout" method="post" ref={formRef}>
            {next ? <input name="next" type="hidden" value={next} /> : null}
            <AuthPrimaryButton type="submit">Sign me out</AuthPrimaryButton>
          </form>
        )}
      </AuthContent>
    </AuthShell>
  );
}
