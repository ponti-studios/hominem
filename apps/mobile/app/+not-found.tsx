import { Link, Stack } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { Text, makeStyles } from '~/components/theme';

import { Screen } from '~/components/Screen';

export default function NotFoundScreen() {
  const styles = useStyles();

  return (
    <>
      <Stack.Screen options={{ title: 'NOT_FOUND' }} />
      <Screen>
        <Text variant="title" color="foreground">
          RESOURCE_NOT_FOUND.
        </Text>
        <Link href={'/' as RelativePathString} style={styles.link}>
          <Text variant="body" color="text-secondary">
            RETURN_TO_ROOT
          </Text>
        </Link>
      </Screen>
    </>
  );
}

const useStyles = makeStyles((theme) => ({
  link: {
    marginTop: theme.spacing.m_16,
    paddingVertical: theme.spacing.m_16,
  },
}));
