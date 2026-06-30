import { translateUi } from "../../translations";
import { Button } from "../button";
import { TextField } from "../text-field";
import { PasskeyButton } from "./passkey-button";

export interface EmailEntryFormProps {
  email: string;
  error?: string;
  isSubmitting?: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: () => void | Promise<void>;
  onPasskeyClick?: () => void | Promise<void>;
}

export function EmailEntryForm({
  email,
  error,
  isSubmitting = false,
  onEmailChange,
  onSubmit,
  onPasskeyClick,
}: EmailEntryFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <div className="space-y-3">
        <TextField
          label={translateUi("auth.emailEntry.emailLabel")}
          name="email"
          type="email"
          value={email}
          autoComplete="email"
          required
          placeholder={translateUi("auth.emailEntry.emailPlaceholder")}
          disabled={isSubmitting}
          error={error}
          onChange={(event) => onEmailChange(event.target.value)}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
          isLoading={isSubmitting}
          loadingLabel={translateUi("auth.emailEntry.submitButtonLoading")}
        >
          {translateUi("auth.emailEntry.submitButton")}
        </Button>

        {onPasskeyClick ? <PasskeyButton onClick={onPasskeyClick} disabled={isSubmitting} /> : null}
      </div>
    </form>
  );
}
