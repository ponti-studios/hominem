import { View } from 'react-native';

import { useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';

import { StageCrossfade, type StageCrossfadeStage } from './StageCrossfade';
import type { TimeProcessingStage } from './time-types';

const STAGES: StageCrossfadeStage<TimeProcessingStage>[] = [
  { id: 'understanding', label: 'Understanding your request' },
  { id: 'checkingSchedule', label: 'Checking your schedule' },
  { id: 'preparingSuggestion', label: 'Preparing your suggestion' },
];

interface TimeProcessingViewProps {
  onCancel: () => void;
  stage: TimeProcessingStage;
}

export function TimeProcessingView({ onCancel, stage }: TimeProcessingViewProps) {
  const styles = useStyles(() => ({
    container: { gap: 24, paddingVertical: 24 },
    button: { marginTop: 4 },
  }));

  return (
    <View style={styles.container}>
      <StageCrossfade current={stage} stages={STAGES} />
      <Button
        label="Cancel"
        onPress={onCancel}
        style={styles.button}
        variant="primary"
        testID="time-processing-cancel"
      />
    </View>
  );
}
