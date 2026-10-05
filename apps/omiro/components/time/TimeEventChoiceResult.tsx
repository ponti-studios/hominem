import { Pressable, Text } from 'react-native';

import { useStyles } from '~/components/theme';

import { formatDateTime } from './time-result-formatters';
import type { TimeInteractionState } from './time-types';
import { CancelRow } from './TimeResultActions';

interface TimeEventChoiceResultProps {
  candidates: Extract<TimeInteractionState, { kind: 'event-choice' }>['candidates'];
  onCancel?: () => void;
  onChooseEvent?: (id: string) => void;
}

export function TimeEventChoiceResult({
  candidates,
  onCancel,
  onChooseEvent,
}: TimeEventChoiceResultProps) {
  const styles = useStyles((theme) => ({
    heading: { ...theme.textVariants.title1, color: theme.colors.foreground },
    choice: {
      backgroundColor: theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      gap: 2,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    title: { ...theme.textVariants.headline, color: theme.colors.foreground },
    time: { ...theme.textVariants.subhead, color: theme.colors.mutedForeground },
  }));

  return (
    <>
      <Text style={styles.heading}>Which event did you mean?</Text>
      {candidates.map((event) => (
        <Pressable
          accessibilityLabel={`${event.title}, ${new Date(event.startDate).toLocaleString()}`}
          accessibilityRole="button"
          key={`${event.id}:${event.startDate}`}
          onPress={() => onChooseEvent?.(event.id)}
          style={({ pressed }) => [styles.choice, pressed && { opacity: 0.8 }]}
          testID="time-event-choice"
        >
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.time}>{formatDateTime(event.startDate)}</Text>
        </Pressable>
      ))}
      <CancelRow onCancel={onCancel} testID="time-event-choice-cancel" />
    </>
  );
}
