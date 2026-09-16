import DateTimePicker from '@expo/ui/community/datetime-picker';
import type { SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useStyles, withAlpha } from '~/components/theme';
import { TextField } from '~/components/ui';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
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
  const { mutedForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    intentBadge: {
      alignSelf: 'flex-start',
      backgroundColor: withAlpha(theme.colors.muted, 0.7),
      borderRadius: theme.borderRadii.sm,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    intentLabel: { ...theme.textVariants.caption1, color: theme.colors.mutedForeground },
    titleField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.muted,
      borderRadius: theme.borderRadii.lg,
      paddingLeft: 12,
      paddingRight: 10,
    },
    titleInput: {
      flex: 1,
      borderRadius: 0,
      borderWidth: 0,
      minHeight: 0,
      paddingHorizontal: 0,
      paddingVertical: 10,
      ...theme.textVariants.body,
      fontWeight: '500',
    },
    fields: { gap: 1 },
    editorBox: { gap: 8, paddingVertical: 10 },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
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
      <View style={styles.intentBadge}>
        <Text style={styles.intentLabel}>{getIntentLabel(block.primary_intent)}</Text>
      </View>
      <View style={styles.titleField}>
        <TextField
          accessibilityLabel="Edit title"
          autoFocus
          focusBorder={false}
          onChangeText={(value) => onEditField?.('title', value)}
          placeholder={t.timeResult.fieldLabels.title}
          testID="time-draft-edit-title"
          value={block.title ?? ''}
          style={styles.titleInput}
        />
        <AppIcon name="pencil" size={13} tintColor={mutedForeground} />
      </View>
      <View style={styles.fields}>
        {when ? (
          <FieldRow
            active={activeField === 'when'}
            editable={canEditWhen}
            icon="clock.fill"
            label="When"
            onPress={canEditWhen ? () => toggleField('when') : undefined}
            testID="time-draft-edit-when"
            value={when}
          />
        ) : null}
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

        <FieldRow
          active={activeField === 'where'}
          editable
          icon="mappin.and.ellipse"
          label="Where"
          muted={!block.location}
          onPress={() => toggleField('where')}
          testID="time-draft-edit-where"
          value={block.location ?? 'Add location'}
        />
        {activeField === 'where' ? (
          <View style={styles.editorBox}>
            <LocationSearchField
              onChange={(value) => onEditField?.('location', value)}
              testID="time-draft-location"
              value={block.location ?? ''}
            />
          </View>
        ) : null}

        <FieldRow icon="person.2.fill" label="Who" value={participants} />
      </View>
      <View style={styles.actions}>
        <Button
          label="Discard"
          onPress={() => onCancel?.()}
          style={styles.actionButton}
          testID="time-draft-cancel"
          variant="outline"
        />
        <Button
          disabled={isSaving || !canSubmit}
          label={confirmLabel}
          loading={isSaving}
          onPress={() => onSubmitDraft?.()}
          style={styles.actionButton}
          testID="time-draft-submit"
          variant="primary"
        />
      </View>
    </>
  );
}

function FieldRow({
  active = false,
  editable = false,
  icon,
  label,
  muted = false,
  onPress,
  testID,
  value,
}: {
  active?: boolean;
  editable?: boolean;
  icon: SFSymbol;
  label: string;
  muted?: boolean;
  onPress?: () => void;
  testID?: string;
  value: string | null;
}) {
  const { mutedForeground, primaryForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    iconWrap: {
      width: 26,
      height: 26,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: active ? theme.colors.primary : theme.colors.muted,
    },
    content: { flex: 1 },
    label: { ...theme.textVariants.caption2, color: theme.colors.mutedForeground },
    value: {
      ...theme.textVariants.footnote,
      color: muted ? theme.colors.mutedForeground : theme.colors.foreground,
    },
  }));
  if (!value) {
    return null;
  }
  return (
    <Pressable
      accessibilityLabel={editable ? `Edit ${label.toLowerCase()}` : label}
      disabled={!onPress}
      onPress={onPress}
      style={styles.row}
      testID={testID}
    >
      <View style={styles.iconWrap}>
        <AppIcon name={icon} size={13} tintColor={active ? primaryForeground : undefined} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      {editable ? (
        <AppIcon
          name={active ? 'chevron.down' : 'chevron.right'}
          size={11}
          tintColor={mutedForeground}
        />
      ) : null}
    </Pressable>
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
