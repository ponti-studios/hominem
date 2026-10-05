import { Stack } from 'expo-router';

import { useNativeHeaderOptions } from '~/components/navigation/native-header';

export default function ChatsStackLayout() {
  const headerOptions = useNativeHeaderOptions();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen dangerouslySingular name="[id]" />
    </Stack>
  );
}
