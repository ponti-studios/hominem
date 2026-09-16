import { useMemo, useState } from 'react';

import {
  StreamScreen,
  streamFilterOptions,
  type StreamFilter,
} from '~/components/inbox/StreamScreen';
import { useFloatingNavBarContent } from '~/components/navigation/FloatingNavBar';
import { NavigationMenu } from '~/components/navigation/NavigationMenu';
import { RootSceneGesture } from '~/components/navigation/RootSceneGesture';
import { SegmentedControl } from '~/components/ui';

export default function StreamRoute() {
  const [filter, setFilter] = useState<StreamFilter>('all');

  const center = useMemo(
    () => (
      <SegmentedControl
        onChange={setFilter}
        options={streamFilterOptions}
        testID="stream-filter"
        value={filter}
      />
    ),
    [filter],
  );
  const menu = useMemo(() => <NavigationMenu />, []);
  useFloatingNavBarContent(useMemo(() => ({ center, menu }), [center, menu]));

  return (
    <RootSceneGesture>
      <StreamScreen filter={filter} topInset={8} />
    </RootSceneGesture>
  );
}
