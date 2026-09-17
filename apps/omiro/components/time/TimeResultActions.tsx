import { View } from 'react-native';

import { useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';

export function CancelRow({ onCancel, testID }: { onCancel?: () => void; testID: string }) {
  const styles = useStyles(() => ({
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  }));
  return (
    <View style={styles.actions}>
      <CancelButton testID={testID} onCancel={onCancel} />
    </View>
  );
}

export function CancelButton({ onCancel, testID }: { onCancel?: () => void; testID: string }) {
  const styles = useStyles(() => ({ button: { flex: 1 } }));
  return (
    <Button
      label="Dismiss"
      onPress={() => onCancel?.()}
      style={styles.button}
      testID={testID}
      variant="outline"
    />
  );
}
