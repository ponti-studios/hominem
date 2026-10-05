import { Stack } from 'expo-router';

import {
  SettingsHeaderButton,
  useNativeHeaderOptions,
} from '~/components/navigation/native-header';

export default function TasksStackLayout() {
  const headerOptions = useNativeHeaderOptions();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: true,
          headerRight: () => <SettingsHeaderButton />,
          title: 'Tasks',
        }}
      />
    </Stack>
  );
}
