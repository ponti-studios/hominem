import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Text } from 'react-native';

import { useNavBarContent } from '~/components/navigation/NavBar';
import { NavigationMenu } from '~/components/navigation/NavigationMenu';
import { useAppTheme, useStyles } from '~/components/theme';
import { TasksScreen } from '~/components/time/TasksScreen';

export default function UnscheduledTasksRoute() {
  const { foreground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    title: { ...theme.textVariants.headline, color: foreground },
  }));

  const center = useMemo(() => <Text style={styles.title}>Tasks</Text>, [styles.title]);
  const menu = useMemo(() => <NavigationMenu />, []);
  useNavBarContent(useMemo(() => ({ center, menu }), [center, menu]));

  return (
    <>
      <Stack.Screen options={{ headerBackButtonDisplayMode: 'minimal' }} />
      <TasksScreen />
    </>
  );
}
