import { KeyIcon } from 'lucide-react';

import { translateUi } from '../../translations';
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
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="gap-4"
    >
      <KeyIcon size={16} />
      {isLoading
        ? translateUi('auth.emailEntry.passkeyLoadingButton')
        : translateUi('auth.emailEntry.passkeyButton')}
    </Button>
  );
}
