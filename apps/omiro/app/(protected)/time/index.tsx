import { useMemo } from 'react';
import { Text } from 'react-native';

import { useFloatingNavBarContent } from '~/components/navigation/FloatingNavBar';
import { NavigationMenu } from '~/components/navigation/NavigationMenu';
import { RootSceneGesture } from '~/components/navigation/RootSceneGesture';
import { useAppTheme, useStyles } from '~/components/theme';
import { TimeHeaderActions, TimeScreen } from '~/components/time/TimeScreen';

export default function TimeRoute() {
  const { foreground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    title: { ...theme.textVariants.subhead, color: foreground },
  }));

  const center = useMemo(() => <Text style={styles.title}>Time</Text>, [styles.title]);
  const menu = useMemo(
    () => (
      <>
        <TimeHeaderActions />
        <NavigationMenu />
      </>
    ),
    [],
  );
  useFloatingNavBarContent(useMemo(() => ({ center, menu }), [center, menu]));

  return (
    <RootSceneGesture>
      <TimeScreen />
    </RootSceneGesture>
  );
}
