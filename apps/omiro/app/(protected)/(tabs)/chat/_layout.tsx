import { Stack } from 'expo-router';

import {
  inlineTitleOptions,
  menuHeaderLeftItems,
  settingsHeaderRightItems,
  useNativeHeaderOptions,
} from '~/components/navigation/native-header';

export default function ChatStackLayout() {
  const headerOptions = useNativeHeaderOptions();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen
        name="index"
        options={{
          ...inlineTitleOptions,
          unstable_headerLeftItems: menuHeaderLeftItems,
          unstable_headerRightItems: settingsHeaderRightItems,
          title: 'Chat',
        }}
      />
    </Stack>
  );
}
