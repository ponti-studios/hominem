import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { translateUi } from '../../translations';
import { Button } from '../button';
import { TextField } from '../text-field';
import { AuthScaffold } from './auth-scaffold';
import { PasskeyButton } from './passkey-button';

interface EmailEntryFormProps {
  error?: string;
  onSubmit: (input: { email: string; next: string | null }) => Promise<void>;
  onPasskeyClick?: () => void | Promise<void>;
}

export function EmailEntryForm({ error, onSubmit, onPasskeyClick }: EmailEntryFormProps) {
  const [searchParams] = useSearchParams();
  const [clientError, setClientError] = useState<string | null>(null);
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);
  const isSubmitting = isClientSubmitting;
  const next = searchParams.get('next');

  const hasPasskey = onPasskeyClick !== undefined;
  const displayError = error ?? clientError ?? undefined;

  return (
    <AuthScaffold
      title={translateUi('auth.emailEntry.title')}
      helperText={translateUi('auth.emailEntry.helper')}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const email = String(formData.get('email') ?? '')
            .trim()
            .toLowerCase();

          setClientError(null);
          setIsClientSubmitting(true);

          void onSubmit({ email, next })
            .catch((caughtError) => {
              setClientError(
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
            disabled={isSubmitting}
            error={displayError}
          />

          <Button type="submit" variant="primary" disabled={isSubmitting} fullWidth>
            {isSubmitting
              ? translateUi('auth.emailEntry.submitButtonLoading')
              : translateUi('auth.emailEntry.submitButton')}
          </Button>

          {hasPasskey && onPasskeyClick ? (
            <PasskeyButton onClick={onPasskeyClick} disabled={isSubmitting} />
          ) : null}
        </div>
      </form>
    </AuthScaffold>
  );
}
