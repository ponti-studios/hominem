import { Stack } from 'expo-router';
import { View } from 'react-native';

import {
  SettingsHeaderButton,
  useNativeHeaderOptions,
} from '~/components/navigation/native-header';
import { TimeHeaderActions } from '~/components/time/TimeScreen';

export default function TimeStackLayout() {
  const headerOptions = useNativeHeaderOptions();
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: false,
          headerRight: () => (
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
              <TimeHeaderActions />
              <SettingsHeaderButton />
            </View>
          ),
          headerTitle: '',
          title: 'Time',
        }}
      />
    </Stack>
  );
}
