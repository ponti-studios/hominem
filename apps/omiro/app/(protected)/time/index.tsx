import { Stack } from 'expo-router';

import { NavigationMenu } from '~/components/navigation/NavigationMenu';
import { RootSceneGesture } from '~/components/navigation/RootSceneGesture';
import { TimeHeaderActions, TimeScreen } from '~/components/time/TimeScreen';

export default function TimeRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Time',
          headerLargeTitle: false,
          headerLeft: () => <NavigationMenu />,
          headerRight: () => <TimeHeaderActions />,
        }}
      />
      <RootSceneGesture>
        <TimeScreen />
      </RootSceneGesture>
    </>
  );
}
