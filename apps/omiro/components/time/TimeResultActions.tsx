import { View } from 'react-native';

import { Button } from '~/components/ui/button';

export function CancelRow({ onCancel, testID }: { onCancel?: () => void; testID: string }) {
  return (
    <View>
      <CancelButton onCancel={onCancel} testID={testID} />
    </View>
  );
}

export function CancelButton({ onCancel, testID }: { onCancel?: () => void; testID: string }) {
  return (
    <Button
      label="Dismiss"
      onPress={() => onCancel?.()}
      size="lg"
      testID={testID}
      variant="secondary"
    />
  );
}
