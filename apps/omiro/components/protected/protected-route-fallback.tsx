import { View } from 'react-native';

import { makeStyles } from '~/components/theme';

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors['surface-canvas'],
  },
}));

export function ProtectedRouteFallback() {
  const styles = useStyles();
  return <View testID="protected-route-fallback" style={styles.root} />;
}
