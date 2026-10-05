import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import { Chip, TextField } from '~/components/ui';
import { Button } from '~/components/ui/button';
import t from '~/translations';

import { LocationSearchField } from './LocationSearchField';
import type { EditableTimeBlockField, TimeInteractionState } from './time-types';
import { formatDraftWhen } from './time-utils';

type DraftBlock = Extract<TimeInteractionState, { kind: 'draft' }>['block'];
type ActiveDraftField = 'when' | 'where' | null;

interface TimeDraftResultProps {
  block: DraftBlock;
  isSaving?: boolean;
  onCancel?: () => void;
  onEditField?: (field: EditableTimeBlockField, value: string) => void;
  onSubmitDraft?: () => void;
}

export function TimeDraftResult({
  block,
  isSaving,
  onCancel,
  onEditField,
  onSubmitDraft,
}: TimeDraftResultProps) {
  const [activeField, setActiveField] = useState<ActiveDraftField>(null);
  const styles = useStyles((theme) => ({
    overline: {
      ...theme.textVariants.label,
      color: theme.colors.mutedForeground,
      textTransform: 'uppercase',
    },
    titleInput: {
      ...theme.textVariants.largeTitle,
      borderRadius: 0,
      color: theme.colors.foreground,
      minHeight: 0,
      paddingHorizontal: 0,
      paddingVertical: 4,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    editorBox: { gap: 8 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    actionButton: { flex: 1 },
  }));
  const canSubmit =
    block.primary_intent === 'add_task' ||
    ((block.primary_intent === 'add_event' || block.primary_intent === 'add_recurring_event') &&
      !!block.start_time &&
      !!block.end_time);
  const when = formatDraftWhen(block);
  const eventTimes =
    block.start_time && block.end_time ? { end: block.end_time, start: block.start_time } : null;
  const deadline = block.deadline_fixed;
  const canEditWhen = !!eventTimes || !!deadline;
  const participants = block.participants?.join(', ') ?? null;
  const confirmLabel = block.primary_intent === 'add_task' ? 'Add task' : 'Add to calendar';

  const toggleField = (field: Exclude<ActiveDraftField, null>) => {
    setActiveField((current) => (current === field ? null : field));
  };

  return (
    <>
      <Text style={styles.overline}>{getIntentLabel(block.primary_intent)}</Text>
      <TextField
        accessibilityLabel="Edit title"
        autoFocus
        focusBorder={false}
        onChangeText={(value) => onEditField?.('title', value)}
        placeholder={t.timeResult.fieldLabels.title}
        style={styles.titleInput}
        testID="time-draft-edit-title"
        value={block.title ?? ''}
      />
      <View style={styles.chips}>
        {when ? (
          <Chip
            icon="calendar"
            label={when}
            onPress={canEditWhen ? () => toggleField('when') : undefined}
            testID="time-draft-edit-when"
            tone={activeField === 'when' ? 'ink' : 'tonal'}
          />
        ) : null}
        <Chip
          icon="mappin.and.ellipse"
          label={block.location ?? 'Add place'}
          onPress={() => toggleField('where')}
          testID="time-draft-edit-where"
          tone={activeField === 'where' ? 'ink' : 'tonal'}
        />
        {participants ? <Chip icon="person.2" label={participants} /> : null}
      </View>
      {activeField === 'when' && eventTimes ? (
        <View style={styles.editorBox}>
          <DateTimePicker
            display="compact"
            mode="datetime"
            onValueChange={(_, date) => onEditField?.('start_time', date.toISOString())}
            testID="time-draft-start-picker"
            value={new Date(eventTimes.start)}
          />
          <DateTimePicker
            display="compact"
            minimumDate={new Date(eventTimes.start)}
            mode="datetime"
            onValueChange={(_, date) => onEditField?.('end_time', date.toISOString())}
            testID="time-draft-end-picker"
            value={new Date(eventTimes.end)}
          />
        </View>
      ) : activeField === 'when' && deadline ? (
        <View style={styles.editorBox}>
          <DateTimePicker
            display="compact"
            mode="date"
            onValueChange={(_, date) =>
              onEditField?.('deadline_fixed', date.toISOString().slice(0, 10))
            }
            testID="time-draft-deadline-picker"
            value={new Date(`${deadline}T12:00:00`)}
          />
        </View>
      ) : null}
      {activeField === 'where' ? (
        <View style={styles.editorBox}>
          <LocationSearchField
            onChange={(value) => onEditField?.('location', value)}
            testID="time-draft-location"
            value={block.location ?? ''}
          />
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Not now"
          onPress={() => onCancel?.()}
          size="lg"
          style={styles.actionButton}
          testID="time-draft-cancel"
          variant="secondary"
        />
        <Button
          disabled={isSaving || !canSubmit}
          label={confirmLabel}
          loading={isSaving}
          onPress={() => onSubmitDraft?.()}
          size="lg"
          style={styles.actionButton}
          testID="time-draft-submit"
          variant="primary"
        />
      </View>
    </>
  );
}

function getIntentLabel(intent: DraftBlock['primary_intent']) {
  return {
    add_task: 'Task',
    add_event: 'Event',
    add_recurring_event: 'Recurring event',
    edit_event: 'Edit event',
    cancel_event: 'Cancel event',
    search: 'Search',
    schedule_gap_fill: 'Find time',
  }[intent];
}
