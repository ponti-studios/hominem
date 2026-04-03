import { AUTH_COPY } from '@hominem/auth';
import { Form, useNavigation, useSearchParams } from 'react-router';

import { Button } from '../ui/button';
import { PasskeyButton } from './passkey-button';
import { TextField } from '../ui/text-field';

interface EmailEntryFormProps {
  action: string;
  method?: 'post' | 'get';
  error?: string;
  onPasskeyClick?: () => void | Promise<void>;
  className?: string;
}

export function EmailEntryForm({
  action,
  method = 'post',
  error,
  onPasskeyClick,
  className,
}: EmailEntryFormProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isSubmitting = navigation.state === 'submitting' && navigation.formAction === action;
  const next = searchParams.get('next');

  const hasPasskey = onPasskeyClick !== undefined;
  const copy = AUTH_COPY.emailEntry;

  return (
    <Form method={method} action={action} className={className}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="space-y-3">
        <TextField
          label={copy.emailLabel}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={copy.emailPlaceholder}
          disabled={isSubmitting}
          error={error}
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
    </Form>
  );
}
