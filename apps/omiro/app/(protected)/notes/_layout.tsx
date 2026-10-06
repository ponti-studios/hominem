import { Stack } from 'expo-router';

import { useNativeHeaderOptions } from '~/components/navigation/native-header';

// Detail screens draw their own floating header, so the native bar stays off.
export default function NotesStackLayout() {
  const headerOptions = useNativeHeaderOptions();
  return (
    <Stack screenOptions={{ ...headerOptions, headerShown: false }}>
      <Stack.Screen dangerouslySingular name="[id]" />
    </Stack>
  );
}
