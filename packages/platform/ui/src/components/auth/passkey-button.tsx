import { AUTH_COPY } from '@hakumi/auth/shared/ux-contract';

import { Button } from '../button';

interface PasskeyButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function PasskeyButton({
  onClick,
  disabled = false,
  isLoading = false,
  className,
}: PasskeyButtonProps) {
  return (
    <Button
      type="button"
      variant="link"
      size="xs"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`justify-start px-0 text-sm ${className ?? ''}`}
    >
      {isLoading ? AUTH_COPY.emailEntry.passkeyLoadingButton : AUTH_COPY.emailEntry.passkeyButton}
    </Button>
  );
}
