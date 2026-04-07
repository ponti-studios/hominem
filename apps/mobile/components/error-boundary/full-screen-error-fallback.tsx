import { StyleSheet, View } from 'react-native';

import { Button } from '~/components/Button';
import { makeStyles, Text } from '~/theme';

interface FullScreenErrorFallbackProps {
  actionLabel: string;
  message: string;
  onPress: () => void;
}

export function FullScreenErrorFallback({
  actionLabel,
  message,
  onPress,
}: FullScreenErrorFallbackProps) {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <Text variant="header" color="foreground">
        Something went wrong
      </Text>
      <Text variant="body" color="text-tertiary" style={styles.message}>
        {message}
      </Text>
      <Button variant="primary" style={styles.button} onPress={onPress} title={actionLabel} />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.colors.background,
      padding: t.spacing.ml_24,
    },
    message: {
      marginTop: t.spacing.sm_12,
      textAlign: 'center',
      maxWidth: 300,
    },
    button: {
      marginTop: t.spacing.ml_24,
      backgroundColor: t.colors['text-primary'],
    },
  }),
);
