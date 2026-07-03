import type { Task } from '@hominem/rpc/types';
import { Pressable, View } from 'react-native';

import { Text, fontSizes, makeStyles, themeSpacing, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

export interface TaskListItemData extends Task {
  childCount?: number;
}

interface TaskListItemProps {
  task: TaskListItemData;
  onPress?: () => void;
  onToggleComplete: () => void;
}

export function TaskListItem({ task, onPress, onToggleComplete }: TaskListItemProps) {
  const styles = useStyles();
  const themeColors = useThemeColors();
  const isCompleted = task.status === 'completed';
  const isList = (task.childCount ?? 0) > 0;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={
          isCompleted ? `${task.title}, completed` : `${task.title}, mark complete`
        }
        accessibilityRole="checkbox"
        hitSlop={themeSpacing.sm}
        onPress={onToggleComplete}
        testID={`task-checkbox-${task.id}`}
      >
        <AppIcon
          name={isCompleted ? 'checkmark.circle.fill' : 'circle'}
          size={22}
          tintColor={isCompleted ? themeColors.accent : themeColors['text-tertiary']}
        />
      </Pressable>

      <Pressable
        accessibilityLabel={task.title}
        accessibilityRole="button"
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.content, pressed && onPress && styles.pressed]}
        testID={`task-item-${task.id}`}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            { color: isCompleted ? themeColors['text-tertiary'] : themeColors['text-primary'] },
            isCompleted && styles.titleCompleted,
          ]}
        >
          {task.title}
        </Text>
        {isList ? (
          <Text style={[styles.meta, { color: themeColors['text-secondary'] }]}>
            {t.tasks.tasksCount(task.childCount ?? 0)}
          </Text>
        ) : null}
      </Pressable>

      {isList ? (
        <AppIcon name="chevron.right" size={12} tintColor={themeColors['text-tertiary']} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  content: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  meta: {
    fontSize: fontSizes.footnote,
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: theme.colors['border-subtle'],
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: themeSpacing.sm,
    minHeight: 52,
    paddingVertical: 12,
  },
  title: {
    fontSize: fontSizes.md,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
  },
}));
