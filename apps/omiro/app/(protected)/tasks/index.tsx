import { Stack, useIsFocused } from 'expo-router';
import { View } from 'react-native';

import { TasksPane } from '~/components/tasks/TasksPane';
import { makeStyles } from '~/components/theme';
import t from '~/translations';

export default function TasksScreen() {
  const styles = useStyles();
  const isFocused = useIsFocused();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t.tasks.screenTitle }} />
      <TasksPane isFocused={isFocused} />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    backgroundColor: theme.colors['bg-base'],
    flex: 1,
  },
}));
