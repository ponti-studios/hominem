import { Stack } from 'expo-router';

import {
  settingsHeaderRightItems,
  useNativeHeaderOptions,
} from '~/components/navigation/native-header';

export default function TasksStackLayout() {
  const headerOptions = useNativeHeaderOptions();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen
        name="index"
        options={{
          unstable_headerRightItems: settingsHeaderRightItems,
          title: 'Tasks',
        }}
      />
      <Stack.Screen name="place" options={{ title: 'Place' }} />
    </Stack>
  );
}
