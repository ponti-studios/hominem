import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import { useCreateNote } from '~/services/notes/use-create-note';
import type { TaskListItem } from '~/services/tasks/task-types';
import { useTaskDelete } from '~/services/tasks/use-task-delete';
import { useTaskUpdate } from '~/services/tasks/use-task-update';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';

import { ageLabel, getInboxTasks, isStale, placeOptions, taskAgeDays } from './task-time';

// Triage: undated tasks one at a time. Give it a day, turn it into a note,
// drop it, or leave it for later. A task that has waited 14 days asks whether
// it is still wanted.
export function PlaceScreen() {
  const router = useRouter();
  const { eventForeground, primary, coral } = useAppTheme().colors;
  const { data: tasks = [] } = useTasksQuery();
  const update = useTaskUpdate();
  const remove = useTaskDelete();
  const createNote = useCreateNote();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  const inbox = getInboxTasks(tasks);
  const queue = inbox.filter((task) => !skipped.includes(task.id));
  const current = queue[0] ?? null;
  const position = inbox.length - queue.length + 1;

  const styles = useStyles((theme) => ({
    content: { gap: 14, padding: 16, paddingBottom: 48 },
    counter: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      paddingTop: 10,
    },
    counterLabel: {
      ...theme.textVariants.footnote,
      color: theme.colors.mutedForeground,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    counterValue: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
    card: {
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii['2xl'],
      gap: 18,
      paddingHorizontal: 20,
      paddingVertical: 22,
    },
    title: { ...theme.textVariants.title1, color: theme.colors.foreground },
    meta: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground, marginTop: 6 },
    question: { ...theme.textVariants.headline, color: theme.colors.foreground, marginBottom: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.pill,
      flexDirection: 'row',
      gap: 6,
      height: 44,
      paddingHorizontal: 16,
    },
    chipPick: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    chipLabel: { ...theme.textVariants.chip, color: theme.colors.foreground },
    chipPickLabel: { ...theme.textVariants.chip, color: theme.colors.primary },
    picker: { alignItems: 'flex-start', marginTop: 12 },
    divider: { backgroundColor: theme.colors.border, height: 1 },
    action: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 48 },
    tile: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.lg,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    tileNote: { backgroundColor: theme.colors.eventSun },
    tileDrop: { backgroundColor: theme.colors.eventCoral },
    actionLabel: { ...theme.textVariants.headline, color: theme.colors.foreground },
    dropLabel: { ...theme.textVariants.headline, color: theme.colors.coral },
    later: {
      ...theme.textVariants.callout,
      color: theme.colors.mutedForeground,
      fontWeight: '700',
      paddingVertical: 6,
      textAlign: 'center',
    },
    doneTitle: { ...theme.textVariants.title2, color: theme.colors.foreground },
    doneBody: { ...theme.textVariants.callout, color: theme.colors.mutedForeground },
  }));

  const placeOn = (task: TaskListItem, date: Date) => {
    setPicking(false);
    update.mutate({ taskId: task.id, patch: { dueAt: date.toISOString() } });
  };

  const makeNote = async (task: TaskListItem) => {
    try {
      await createNote.mutateAsync({
        text: task.notes ? `${task.title}\n\n${task.notes}` : task.title,
        title: task.title,
      });
      remove.mutate(task.id);
    } catch {
      Alert.alert('Could not make a note', 'Try again when you are back online.');
    }
  };

  if (!current) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        testID="place-screen"
      >
        <View style={styles.card}>
          <Text style={styles.doneTitle}>All placed</Text>
          <Text style={styles.doneBody}>
            {skipped.length > 0
              ? 'The rest can wait. They will be here next time.'
              : 'Nothing is waiting for a day.'}
          </Text>
          <Button label="Done" onPress={() => router.back()} size="lg" testID="place-done" />
        </View>
      </ScrollView>
    );
  }

  const age = taskAgeDays(current);
  const meta = isStale(current) ? `Still want this? ${ageLabel(age)}` : ageLabel(age);
  const options = placeOptions();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      testID="place-screen"
    >
      <View style={styles.counter}>
        <Text style={styles.counterLabel}>To place</Text>
        <Text style={styles.counterValue}>{`${position} of ${inbox.length}`}</Text>
      </View>
      <View style={styles.card}>
        <View>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.meta} testID="place-meta">
            {meta}
          </Text>
        </View>
        <View>
          <Text style={styles.question}>When?</Text>
          <View style={styles.chips}>
            {options.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option.key}
                onPress={() => placeOn(current, option.date)}
                style={styles.chip}
                testID={`place-${option.key}`}
              >
                <Text style={styles.chipLabel}>{option.label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setPicking((open) => !open)}
              style={[styles.chip, styles.chipPick]}
              testID="place-pick"
            >
              <AppIcon name="calendar" size={18} tintColor={primary} />
              <Text style={styles.chipPickLabel}>Pick a date</Text>
            </Pressable>
          </View>
          {picking ? (
            <View style={styles.picker}>
              <DateTimePicker
                display="inline"
                minimumDate={new Date()}
                mode="date"
                onValueChange={(_, date) => placeOn(current, new Date(date.setHours(0, 0, 0, 0)))}
                testID="place-date-picker"
                value={new Date()}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          onPress={() => makeNote(current)}
          style={styles.action}
          testID="place-note"
        >
          <View style={[styles.tile, styles.tileNote]}>
            <AppIcon name="doc.text" size={20} tintColor={eventForeground} />
          </View>
          <Text style={styles.actionLabel}>Make it a note</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => remove.mutate(current.id)}
          style={styles.action}
          testID="place-drop"
        >
          <View style={[styles.tile, styles.tileDrop]}>
            <AppIcon name="trash" size={20} tintColor={coral} />
          </View>
          <Text style={styles.dropLabel}>Drop</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setPicking(false);
          setSkipped((ids) => [...ids, current.id]);
        }}
        testID="place-later"
      >
        <Text style={styles.later}>Decide later</Text>
      </Pressable>
    </ScrollView>
  );
}
