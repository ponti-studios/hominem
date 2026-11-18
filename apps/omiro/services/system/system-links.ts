import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { redirectSystemPath } from '~/app/+native-intent';
import OmiroSystem from '~/modules/omiro-system';

// Opens what a Home Screen quick action or a Spotlight result points at. Those
// arrive as app paths from the native side, not as URLs, so they go through
// the same rewrite every other deep link gets. Mounted inside the protected
// shell: a link that cold-started the app waits there until sign-in settles.
export function useSystemLinks() {
  const router = useRouter();
  useEffect(() => {
    const open = (path: string) => router.push(redirectSystemPath({ initial: false, path }));
    const pending = OmiroSystem.consumePendingLink();
    if (pending) {
      open(pending);
    }
    const subscription = OmiroSystem.addListener('onLink', ({ path }) => open(path));
    return () => subscription.remove();
  }, [router]);
}
