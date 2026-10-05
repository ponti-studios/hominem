import { useLocalSearchParams } from 'expo-router';

import { TimeScreen } from '~/components/time/TimeScreen';

export default function TimeRoute() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  return <TimeScreen initialPrompt={prompt} />;
}
