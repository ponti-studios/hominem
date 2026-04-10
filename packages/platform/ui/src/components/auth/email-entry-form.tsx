import { AUTH_COPY } from '@hominem/auth';
import { useState } from 'react';
import { Form, useNavigation, useSearchParams } from 'react-router';

import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { PasskeyButton } from './passkey-button';

interface EmailEntryFormProps {
  action: string;
  method?: 'post' | 'get';
  error?: string;
  onSubmit?: (input: { email: string; next: string | null }) => Promise<void>;
  onPasskeyClick?: () => void | Promise<void>;
  className?: string;
}

export function EmailEntryForm({
  action,
  method = 'post',
  error,
  onSubmit,
  onPasskeyClick,
  className,
}: EmailEntryFormProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [clientError, setClientError] = useState<string | null>(null);
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);
  const isSubmitting = onSubmit
    ? isClientSubmitting
    : navigation.state === 'submitting' && navigation.formAction === action;
  const next = searchParams.get('next');

  const hasPasskey = onPasskeyClick !== undefined;
  const copy = AUTH_COPY.emailEntry;
  const displayError = error ?? clientError ?? undefined;

  const fields = (
    <div className="space-y-3">
      <TextField
        label={copy.emailLabel}
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder={copy.emailPlaceholder}
        disabled={isSubmitting}
        error={displayError}
      />

      <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Sending…' : copy.submitButton}
      </Button>

      {hasPasskey && onPasskeyClick ? (
        <div className="flex justify-center pt-1">
          <PasskeyButton onClick={onPasskeyClick} disabled={isSubmitting} />
        </div>
      ) : null}
    </div>
  );

  if (onSubmit) {
    return (
      <form
        className={className}
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
                  : 'Failed to send verification code.',
              );
            })
            .finally(() => {
              setIsClientSubmitting(false);
            });
        }}
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {fields}
      </form>
    );
  }

  return (
    <Form method={method} action={action} className={className}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {fields}
    </Form>
  );
}
