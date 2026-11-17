import { Stack } from 'expo-router';

import {
  inlineTitleOptions,
  settingsHeaderRightItems,
  useNativeHeaderOptions,
} from '~/components/navigation/native-header';

export default function NotesStackLayout() {
  const headerOptions = useNativeHeaderOptions();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen
        name="index"
        options={{
          ...inlineTitleOptions,
          unstable_headerRightItems: settingsHeaderRightItems,
          title: 'Notes',
        }}
      />
    </Stack>
  );
}
