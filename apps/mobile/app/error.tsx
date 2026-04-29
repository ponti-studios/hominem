import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';

import { FullScreenErrorFallback } from '~/components/error-boundary/FullScreenErrorFallback';
import t from '~/translations';

export default function ErrorScreen({ error }: { error: Error }) {
  const router = useRouter();

  return (
    <FullScreenErrorFallback
      actionLabel={t.errors.goHome}
      message={error?.message || t.errors.somethingWentWrong}
      onPress={() => router.replace('/' as RelativePathString)}
    />
  );
}
