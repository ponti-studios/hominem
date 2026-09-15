import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';

import type { TimeProcessingStage } from './time-types';

const STAGES: { id: TimeProcessingStage; label: string }[] = [
  { id: 'understanding', label: 'Understanding your request' },
  { id: 'checkingSchedule', label: 'Checking your schedule' },
  { id: 'preparingSuggestion', label: 'Preparing your suggestion' },
];

interface TimeProcessingViewProps {
  onCancel: () => void;
  stage: TimeProcessingStage;
}

export function TimeProcessingView({ onCancel, stage }: TimeProcessingViewProps) {
  const reducedMotion = useReducedMotion();
  const theme = useAppTheme();
  const styles = useStyles((currentTheme) => ({
    container: { gap: 20, paddingVertical: 16 },
    eyebrow: { ...currentTheme.textVariants.caption1, color: currentTheme.colors.mutedForeground },
    stageList: { gap: 12 },
    stage: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    indicator: { width: 10, height: 10, borderRadius: 999 },
    label: { ...currentTheme.textVariants.body, flex: 1 },
    button: { marginTop: 4 },
  }));
  const activeIndex = STAGES.findIndex((candidate) => candidate.id === stage);

  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="progressbar" style={styles.container}>
      <Animated.View
        entering={reducedMotion ? FadeIn.duration(150) : FadeInUp.duration(220)}
        key={stage}
      >
        <Text style={styles.eyebrow}>Working on it</Text>
      </Animated.View>
      <View style={styles.stageList}>
        {STAGES.map((candidate, index) => {
          const isActive = index === activeIndex;
          const isComplete = activeIndex > index;
          return (
            <Animated.View
              entering={reducedMotion ? FadeIn.duration(120) : FadeInUp.duration(180)}
              key={candidate.id}
              style={styles.stage}
            >
              <View
                style={[
                  styles.indicator,
                  {
                    backgroundColor:
                      isActive || isComplete ? theme.colors.primary : theme.colors.muted,
                    opacity: isActive || isComplete ? 1 : 0.6,
                  },
                ]}
              />
              <Text
                style={[
                  styles.label,
                  { color: isActive ? theme.colors.foreground : theme.colors.mutedForeground },
                ]}
              >
                {candidate.label}
              </Text>
            </Animated.View>
          );
        })}
      </View>
      <Button
        label="Cancel"
        onPress={onCancel}
        style={styles.button}
        variant="secondary"
        testID="time-processing-cancel"
      />
    </View>
  );
}
