import { OTP_LENGTH, normalizeOtp } from "../../lib";
import { translateUi } from "../../translations";
import { Button } from "../button";
import { OtpCodeInput } from "./otp-code-input";

export interface OtpVerificationFormProps {
  email: string;
  otp: string;
  error?: string;
  isSubmitting?: boolean;
  isResending?: boolean;
  onOtpChange: (otp: string) => void;
  onSubmit: () => void | Promise<void>;
  onResend: () => void | Promise<void>;
  onChangeEmail: () => void;
}

export function OtpVerificationForm({
  email,
  otp,
  error,
  isSubmitting = false,
  isResending = false,
  onOtpChange,
  onSubmit,
  onResend,
  onChangeEmail,
}: OtpVerificationFormProps) {
  const normalizedOtp = normalizeOtp(otp);
  const canSubmit = normalizedOtp.length === OTP_LENGTH && !isSubmitting && !isResending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="otp" value={normalizedOtp} />

      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <label className="body-3 text-text-primary font-medium" htmlFor="otp-verification-code">
            {translateUi("auth.otpVerification.codeLabel")}
          </label>
          <OtpCodeInput
            id="otp-verification-code"
            value={otp}
            disabled={isSubmitting || isResending}
            error={error}
            autoFocus
            onChange={onOtpChange}
          />
          {error ? (
            <p className="body-4 text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full"
          isLoading={isSubmitting}
          loadingLabel={translateUi("auth.otpVerification.verifyButtonLoading")}
        >
          {translateUi("auth.otpVerification.verifyButton")}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => void onResend()}
            disabled={isResending || isSubmitting}
            className="px-0"
            isLoading={isResending}
            loadingLabel={translateUi("auth.otpVerification.resendButtonLoading")}
          >
            {translateUi("auth.otpVerification.resendButton")}
          </Button>

          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={onChangeEmail}
            disabled={isSubmitting}
            className="px-0"
          >
            {translateUi("auth.otpVerification.changeEmailLink")}
          </Button>
        </div>
      </div>
    </form>
  );
}
