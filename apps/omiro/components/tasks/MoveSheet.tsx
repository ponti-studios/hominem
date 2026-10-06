import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import { BottomSheet } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import type { TaskListItem } from '~/services/tasks/task-types';

import { moveOptions } from './task-time';

interface MoveSheetProps {
  task: TaskListItem | null;
  onClose: () => void;
  onMove: (task: TaskListItem, date: Date) => void;
}

// "Move to": a new day for a task, from a few quick dates or a calendar.
export function MoveSheet({ task, onClose, onMove }: MoveSheetProps) {
  const { primary, mutedForeground } = useAppTheme().colors;
  const [picking, setPicking] = useState(false);
  const [lastTask, setLastTask] = useState<TaskListItem | null>(null);
  // Hold the last task so the sheet keeps its content while animating out.
  if (task && task !== lastTask) {
    setLastTask(task);
    setPicking(false);
  }
  const shown = task ?? lastTask;
  const styles = useStyles((theme) => ({
    title: {
      ...theme.textVariants.title2,
      color: theme.colors.foreground,
      paddingBottom: 6,
      textAlign: 'center',
    },
    row: {
      alignItems: 'center',
      borderBottomColor: theme.colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 14,
      minHeight: 54,
    },
    lastRow: { borderBottomWidth: 0 },
    tile: {
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: 14,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    tilePick: { backgroundColor: theme.colors.eventViolet },
    label: { ...theme.textVariants.headline, color: theme.colors.foreground, flex: 1 },
    pickLabel: { ...theme.textVariants.headline, color: theme.colors.primary, flex: 1 },
    detail: { ...theme.textVariants.footnote, color: mutedForeground, fontWeight: '600' },
    picker: { alignItems: 'center', paddingTop: 8 },
  }));

  const move = (date: Date) => {
    if (shown) {
      onMove(shown, date);
    }
  };

  return (
    <BottomSheet onClose={onClose} testID="move-sheet" visible={task !== null}>
      <View>
        <Text style={styles.title}>Move to</Text>
        {moveOptions().map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.key}
            onPress={() => move(option.date)}
            style={styles.row}
            testID={`move-${option.key}`}
          >
            <View style={styles.tile}>
              <AppIcon name="calendar" size={20} tintColor={mutedForeground} />
            </View>
            <Text style={styles.label}>{option.label}</Text>
            <Text style={styles.detail}>{option.detail}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setPicking((open) => !open)}
          style={[styles.row, styles.lastRow]}
          testID="move-pick"
        >
          <View style={[styles.tile, styles.tilePick]}>
            <AppIcon name="calendar" size={20} tintColor={primary} />
          </View>
          <Text style={styles.pickLabel}>Pick a date</Text>
        </Pressable>
        {picking ? (
          <View style={styles.picker}>
            <DateTimePicker
              display="inline"
              minimumDate={new Date()}
              mode="date"
              onValueChange={(_, date) => move(new Date(date.setHours(0, 0, 0, 0)))}
              testID="move-date-picker"
              value={new Date()}
            />
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}
