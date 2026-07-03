import { Stack, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { posthog } from '~/services/posthog';

function resolveAuthScreenViewEvent(segments: string[]) {
  const authRoute = segments.at(-1);

  switch (authRoute) {
    case 'verify':
      return 'auth_verify_screen_viewed';
    case '(auth)':
    case 'index':
      return 'auth_screen_viewed';
    default:
      return null;
  }
}

function AuthLayout() {
  const segments = useSegments() as string[];
  const lastTrackedEventRef = useRef<string | null>(null);

  useEffect(() => {
    const event = resolveAuthScreenViewEvent(segments);
    if (!event || lastTrackedEventRef.current === event) {
      return;
    }

    lastTrackedEventRef.current = event;
    posthog.capture(event);
  }, [segments]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ headerShown: false }} />
    </Stack>
  );
}

export default AuthLayout;
