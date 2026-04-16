import { KeyRound, X } from 'lucide-react';
import { useCallback, useState } from 'react';

const DISMISSED_KEY = 'hominem_passkey_enrollment_dismissed';

interface PasskeyEnrollmentBannerProps {
  /**
   * Whether WebAuthn is supported in this browser.
   * Obtain from `usePasskeys().isSupported`.
   */
  isSupported: boolean;
  /**
   * Whether the user has any passkeys registered.
   * Pass undefined to hide the banner (loading state).
   */
  hasPasskeys?: boolean | undefined;
  /**
   * Called when the user clicks "Add passkey". Should open the passkey
   * registration flow.
   */
  onEnroll: () => Promise<void>;
}

/**
 * Shows a dismissible banner prompting the user to add a passkey after sign-in.
 *
 * The banner is hidden:
 *  - If the user has already dismissed it (stored in localStorage).
 *  - If the user already has at least one passkey registered.
 *  - If the browser does not support WebAuthn.
 *  - If hasPasskeys is undefined/null (loading state).
 *
 * Place this in the authenticated app layout so it appears once after sign-in.
 */
export function PasskeyEnrollmentBanner({
  isSupported,
  hasPasskeys,
  onEnroll,
}: PasskeyEnrollmentBannerProps) {
  const [enrolling, setEnrolling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const visible =
    isSupported &&
    !dismissed &&
    hasPasskeys !== undefined &&
    hasPasskeys !== null &&
    !hasPasskeys &&
    !localStorage.getItem(DISMISSED_KEY);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }, []);

  const handleEnroll = useCallback(async () => {
    setEnrolling(true);
    try {
      await onEnroll();
      dismiss();
    } catch {
      // Enrollment failed or was cancelled — don't dismiss
    } finally {
      setEnrolling(false);
    }
  }, [onEnroll, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="banner"
      className="flex items-center gap-3 border border-border bg-muted px-4 py-3 text-sm"
    >
      <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="grow text-muted-foreground">
        Sign in faster with a passkey — no password needed.
      </span>
      <button
        type="button"
        onClick={handleEnroll}
        disabled={enrolling}
        className="shrink-0 font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-50"
      >
        {enrolling ? 'Adding...' : 'Add passkey'}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss passkey prompt"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
