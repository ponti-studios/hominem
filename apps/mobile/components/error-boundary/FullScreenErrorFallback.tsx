import { StyleSheet, View } from 'react-native';

import { makeStyles, Text } from '~/components/theme';

import { ErrorMessage } from './ErrorMessage';

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
      <ErrorMessage title="" message={message} actionLabel={actionLabel} onPress={onPress} />
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
  }),
);
