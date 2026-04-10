import { View, StyleSheet } from 'react-native';

import { Button } from '~/components/Button';
import { makeStyles, Text } from '~/components/theme';

interface ErrorMessageProps {
  title: string;
  message: string;
  actionLabel: string;
  onPress: () => void;
}

export function ErrorMessage({ title, message, actionLabel, onPress }: ErrorMessageProps) {
  const styles = useStyles();

  return (
    <View style={styles.content}>
      {title ? (
        <Text variant="header" color="foreground">
          {title}
        </Text>
      ) : null}
      <Text variant="body" color="text-tertiary" style={styles.message}>
        {message}
      </Text>
      <Button variant="primary" style={styles.button} onPress={onPress} title={actionLabel} />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: {
      alignItems: 'center',
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
