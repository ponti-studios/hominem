import { AUTH_COPY } from '@hominem/auth/shared/ux-contract';

import { Button } from '../button';

interface PasskeyButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function PasskeyButton({
  onClick,
  disabled = false,
  isLoading = false,
}: PasskeyButtonProps) {
  return (
    <Button type="button" variant="secondary" onClick={onClick} disabled={disabled || isLoading}>
      {isLoading ? AUTH_COPY.emailEntry.passkeyLoadingButton : AUTH_COPY.emailEntry.passkeyButton}
    </Button>
  );
}
