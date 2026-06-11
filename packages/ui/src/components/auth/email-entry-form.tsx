import { normalizeEmail } from '@hominem/auth/shared/validation';
import { useState } from 'react';

import { translateUi } from '../../translations';
import { Button } from '../button';
import { TextField } from '../text-field';
import { AuthScaffold } from './auth-scaffold';
import { PasskeyButton } from './passkey-button';

interface EmailEntryFormProps {
  error?: string;
  title?: string;
  helperText?: string;
  next?: string | null;
  onSubmit: (input: { email: string; next: string | null }) => Promise<void>;
  onSubmitError?: (error: string | null) => void;
  onPasskeyClick?: () => void | Promise<void>;
}

export function EmailEntryForm({
  error,
  title,
  helperText,
  next,
  onSubmit,
  onSubmitError,
  onPasskeyClick,
}: EmailEntryFormProps) {
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);
  const displayError = error ?? undefined;

  return (
    <AuthScaffold
      title={title ?? translateUi('auth.emailEntry.title')}
      helperText={helperText}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const email = normalizeEmail(String(formData.get('email') ?? ''));

          onSubmitError?.(null);
          setIsClientSubmitting(true);

          void Promise.resolve(onSubmit({ email, next: next ?? null }))
            .catch((caughtError) => {
              onSubmitError?.(
                caughtError instanceof Error
                  ? caughtError.message
                  : translateUi('auth.emailEntry.sendFailedError'),
              );
            })
            .finally(() => {
              setIsClientSubmitting(false);
            });
        }}
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="space-y-3">
          <TextField
            label={translateUi('auth.emailEntry.emailLabel')}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={translateUi('auth.emailEntry.emailPlaceholder')}
            disabled={isClientSubmitting}
            error={displayError}
          />

          <Button type="submit" disabled={isClientSubmitting} className="w-full">
            {isClientSubmitting
              ? translateUi('auth.emailEntry.submitButtonLoading')
              : translateUi('auth.emailEntry.submitButton')}
          </Button>

          {onPasskeyClick ? (
            <PasskeyButton onClick={onPasskeyClick} disabled={isClientSubmitting} />
          ) : null}
        </div>
      </form>
    </AuthScaffold>
  );
}
