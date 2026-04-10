import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';

import { FullScreenErrorFallback } from '~/components/error-boundary/full-screen-error-fallback';

export default function ErrorScreen({ error }: { error: Error }) {
  const router = useRouter();

  return (
    <FullScreenErrorFallback
      actionLabel="Go Home"
      message={error?.message || 'An unexpected error occurred'}
      onPress={() => router.replace('/' as RelativePathString)}
    />
  );
}
