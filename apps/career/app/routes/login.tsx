import { maskEmail } from "@hominem/auth/shared/mask-email";
import { useAuthClient, useEmailAuth } from "@hominem/auth/client/provider";
import { resolveAuthRedirect } from "@hominem/auth/shared/redirect-policy";
import { AuthScaffold, EmailEntryForm, OtpVerificationForm, translateUi } from "@hominem/ui";
import { useState } from "react";
import { redirect, useLocation, useNavigate } from "react-router";

import { userContext } from "~/lib/middleware";

import { Route } from "./+types/login";

export const meta: Route.MetaFunction = () => [
  { title: "Sign In - Craftd" },
  {
    name: "description",
    content: "Sign in to Craftd to create and manage your professional portfolio",
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (user) throw redirect("/account");
  return null;
}

type LoginStep = "email" | "otp";

export default function Login() {
  const authClient = useAuthClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [loginStep, setLoginStep] = useState<LoginStep>("email");
  const next = new URLSearchParams(location.search).get("next");
  const postAuthRedirect = resolveAuthRedirect(next, "/account", [
    "/account",
    "/onboarding",
    "/applications",
    "/resume",
    "/work",
    "/skills",
    "/social",
    "/stats",
    "/projects",
    "/testimonials",
    "/certifications",
  ]).safeRedirect;
  const {
    error,
    email,
    setEmail,
    otp,
    setOtp,
    setError,
    isSubmitting,
    isResending,
    handleSendOtp,
    handleVerifyOtp,
    handleResendOtp,
  } = useEmailAuth({
    sendOtp: async (resolvedEmail) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: resolvedEmail,
        type: "sign-in",
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to send verification code");
      }
      setLoginStep("otp");
    },
    verifyOtp: async (resolvedEmail, submittedOtp) => {
      const result = await authClient.signIn.emailOtp({
        email: resolvedEmail,
        otp: submittedOtp,
      });
      if (result.error || !result.data?.user?.id) {
        throw new Error(
          result.error?.message ?? "Verification failed. Please check your code and try again.",
        );
      }
      navigate(postAuthRedirect);
    },
    resendOtp: async (resolvedEmail) => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: resolvedEmail,
        type: "sign-in",
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to resend verification code");
      }
    },
  });

  if (loginStep === "otp") {
    return (
      <AuthScaffold
        title={translateUi("auth.otpVerification.title")}
        helperText={translateUi("auth.otpVerification.helper", { email: maskEmail(email) })}
      >
        <OtpVerificationForm
          email={email}
          otp={otp}
          error={error ?? undefined}
          isSubmitting={isSubmitting}
          isResending={isResending}
          onOtpChange={(nextOtp) => {
            setOtp(nextOtp);
            setError(null);
          }}
          onSubmit={() => handleVerifyOtp(email, otp)}
          onResend={() => handleResendOtp(email)}
          onChangeEmail={() => setLoginStep("email")}
        />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold title="Sign in">
      <EmailEntryForm
        email={email}
        error={error ?? undefined}
        isSubmitting={isSubmitting}
        onEmailChange={(nextEmail) => {
          setEmail(nextEmail);
          setError(null);
        }}
        onSubmit={() => handleSendOtp(email)}
      />
    </AuthScaffold>
  );
}
