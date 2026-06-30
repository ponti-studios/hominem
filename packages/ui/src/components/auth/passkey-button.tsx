import { KeyIcon } from "lucide-react";

import { translateUi } from "../../translations";
import { Button } from "../button";

export interface PasskeyButtonProps {
  onClick: () => void | Promise<void>;
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
      onClick={() => void onClick()}
      disabled={disabled}
      className="gap-4"
      isLoading={isLoading}
      loadingLabel={translateUi("auth.emailEntry.passkeyLoadingButton")}
    >
      <KeyIcon size={16} />
      {translateUi("auth.emailEntry.passkeyButton")}
    </Button>
  );
}
