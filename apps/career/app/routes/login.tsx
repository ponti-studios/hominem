import { useAuthClient } from "@hominem/auth/client/provider";
import { EmailEntryForm, OtpVerificationForm } from "@hominem/ui";
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
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const next = new URLSearchParams(location.search).get("next");

  if (loginStep === "otp") {
    return (
      <OtpVerificationForm
        email={email}
        defaultNext="/account"
        onSubmit={async ({ email: resolvedEmail, otp }) => {
          const result = await authClient.signIn.emailOtp({ email: resolvedEmail, otp });
          if (result.error || !result.data?.user?.id) {
            throw new Error(
              result.error?.message ?? "Verification failed. Please check your code and try again.",
            );
          }
          navigate("/account");
        }}
        onResend={async (resolvedEmail) => {
          const result = await authClient.emailOtp.sendVerificationOtp({
            email: resolvedEmail,
            type: "sign-in",
          });
          if (result.error) {
            throw new Error(result.error.message ?? "Failed to resend verification code");
          }
        }}
        onChangeEmail={() => setLoginStep("email")}
      />
    );
  }

  return (
    <EmailEntryForm
      title="Sign in"
      next={next}
      error={emailError ?? undefined}
      onSubmitError={setEmailError}
      onSubmit={async ({ email: submittedEmail }) => {
        const result = await authClient.emailOtp.sendVerificationOtp({
          email: submittedEmail,
          type: "sign-in",
        });
        if (result.error) {
          throw new Error(result.error.message ?? "Failed to send verification code");
        }
        setEmail(submittedEmail);
        setLoginStep("otp");
      }}
    />
  );
}
