import { Stack } from 'expo-router';
import { useState } from 'react';

import {
  StreamScreen,
  streamFilterOptions,
  type StreamFilter,
} from '~/components/inbox/StreamScreen';
import { FloatingNavBar, useFloatingNavBarMetrics } from '~/components/navigation/FloatingNavBar';
import { NavigationMenu } from '~/components/navigation/NavigationMenu';
import { RootSceneGesture } from '~/components/navigation/RootSceneGesture';
import { SegmentedControl } from '~/components/ui';

export default function StreamRoute() {
  const [filter, setFilter] = useState<StreamFilter>('all');
  const { contentInset } = useFloatingNavBarMetrics();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerTransparent: true,
          title: 'Stream',
          header: () => (
            <FloatingNavBar
              center={
                <SegmentedControl
                  onChange={setFilter}
                  options={streamFilterOptions}
                  testID="stream-filter"
                  value={filter}
                />
              }
              menu={<NavigationMenu />}
            />
          ),
        }}
      />
      <RootSceneGesture>
        <StreamScreen filter={filter} topInset={contentInset} />
      </RootSceneGesture>
    </>
  );
}
