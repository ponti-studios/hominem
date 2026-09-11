import { emailSchema, loginUrl, type ResumeMode } from '../helpers';
import { OtpField } from './otp-field';
import { PageFrame } from './page-frame';
import { AnimatedProgressButton } from './progress-button';
import { loginPage, pageFrame, progressButton, shared } from './styles.generated';

type LoginPageProps = {
  email: string;
  error?: string;
  mode: ResumeMode;
  resumeQuery: string;
  step: 'email' | 'otp';
};

export function LoginPage({ email, error, resumeQuery, step }: LoginPageProps) {
  const isOtpStep = step === 'otp';
  const changeEmailUrl = loginUrl({ resumeQuery, step: 'email' });
  const progress = isOtpStep ? (email.length > 0 ? 1 : 0) : email.length > 0 ? 0 : 0;

  return (
    <PageFrame>
      <div class={pageFrame.authContent}>
        <div class={pageFrame.authHeading}>
          <h2 id="auth-title">{isOtpStep ? 'Check your email' : 'Sign in to Hominem'}</h2>
          <p class={pageFrame.cardCopy}>
            {isOtpStep
              ? `We sent a verification code to ${email}.`
              : "Enter your email and we'll send you a one-time code — no password to remember."}
          </p>
        </div>
        {error ? (
          <p aria-live="polite" class={pageFrame.alert} role="alert">
            {error}
          </p>
        ) : null}
        <form
          action={isOtpStep ? '/login/verify' : '/login/send'}
          data-error={error ? true : undefined}
          method="post"
        >
          <input name="resume" type="hidden" value={resumeQuery} />
          {isOtpStep ? (
            <>
              <input name="email" type="hidden" value={email} />
              <input id="otp" name="otp" type="hidden" />
              <OtpField />
            </>
          ) : (
            <div class={shared.field}>
              <label htmlFor="email">Email address</label>
              <input
                autoComplete="email"
                autoFocus
                id="email"
                name="email"
                required
                type="email"
                value={email}
              />
            </div>
          )}
          <AnimatedProgressButton
            complete={isOtpStep ? false : emailSchema.safeParse(email).success}
            message={isOtpStep ? 'Enter your 6-digit code' : 'Enter your email'}
            progress={progress}
          >
            <button class={[shared.primaryButton, progressButton.fill].join(' ')} type="submit">
              {isOtpStep ? 'Verify' : 'Continue'}
            </button>
          </AnimatedProgressButton>
        </form>
        {isOtpStep ? (
          <div class={loginPage.authLinks}>
            <form action="/login/send" method="post">
              <input name="resume" type="hidden" value={resumeQuery} />
              <input name="email" type="hidden" value={email} />
              <button class={shared.secondaryButton} type="submit">
                Resend code
              </button>
            </form>
            <a class={shared.secondaryButton} href={changeEmailUrl}>
              Use a different email
            </a>
          </div>
        ) : null}
      </div>
    </PageFrame>
  );
}
