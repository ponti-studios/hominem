import { memo, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import { Checkbox } from '~/components/ui';
import { taskDurationMinutes, type TaskListItem } from '~/services/tasks/task-types';

import { taskTimeLabel } from './task-time';

interface TaskRowProps {
  item: TaskListItem;
  onGround: boolean;
  onOpen: (task: TaskListItem) => void;
  onToggle: (task: TaskListItem) => void;
}

export const TaskRow = memo(function TaskRow({ item, onGround, onOpen, onToggle }: TaskRowProps) {
  const styles = useStyles((theme) => ({
    row: {
      alignItems: 'center',
      backgroundColor: onGround ? theme.colors.card : theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      flexDirection: 'row',
      gap: 14,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    body: { flex: 1, gap: 1, minWidth: 0 },
    title: { ...theme.textVariants.headline, color: theme.colors.foreground },
    meta: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
  }));
  const minutes = taskDurationMinutes(item);
  const when = taskTimeLabel(item);
  const meta = [when, minutes ? `${minutes} min` : null].filter(Boolean).join(' · ');
  const completed = item.status === 'completed';
  return (
    <Pressable
      accessibilityLabel={item.title}
      accessibilityRole="button"
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      testID={`unscheduled-task-${item.id}`}
    >
      <Checkbox
        accessibilityLabel={completed ? 'Mark task incomplete' : 'Mark task complete'}
        checked={completed}
        onToggle={() => onToggle(item)}
      />
      <View style={styles.body}>
        <Text
          numberOfLines={2}
          style={[styles.title, completed && { opacity: 0.45, textDecorationLine: 'line-through' }]}
        >
          {item.title}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
});

interface TaskListProps {
  // True when the list is the screen's scroll view under a native header, so
  // the system insets it below the title and collapses the large title.
  adjustForHeader?: boolean;
  contentPaddingBottom?: number;
  contentPaddingTop?: number;
  emptyText: string;
  // Rendered after the last row (and after the empty text).
  footer?: ReactNode;
  // True on the app ground (Tasks page), where rows need the card fill to
  // stand out; false inside a sheet, where rows sit on the ground tone.
  onGround?: boolean;
  onOpen: (task: TaskListItem) => void;
  onRefresh?: () => void;
  onToggle: (task: TaskListItem) => void;
  refreshing?: boolean;
  tasks: TaskListItem[];
}

function Gap() {
  return <View style={{ height: 10 }} />;
}

export function TaskList({
  adjustForHeader = false,
  contentPaddingBottom = 0,
  contentPaddingTop = 0,
  emptyText,
  footer,
  onGround = false,
  onOpen,
  onRefresh,
  onToggle,
  refreshing = false,
  tasks,
}: TaskListProps) {
  const styles = useStyles((theme) => ({
    footer: { paddingTop: 10 },
    empty: {
      ...theme.textVariants.callout,
      color: theme.colors.mutedForeground,
      paddingVertical: 24,
      textAlign: 'center',
    },
  }));
  return (
    <FlatList
      ItemSeparatorComponent={Gap}
      contentInsetAdjustmentBehavior={adjustForHeader ? 'automatic' : 'never'}
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      ListFooterComponent={footer ? <View style={styles.footer}>{footer}</View> : null}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom, paddingTop: contentPaddingTop }}
      data={tasks}
      initialNumToRender={10}
      keyExtractor={(task) => task.id}
      refreshControl={
        onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} /> : undefined
      }
      removeClippedSubviews
      renderItem={({ item }) => (
        <TaskRow item={item} onGround={onGround} onOpen={onOpen} onToggle={onToggle} />
      )}
      showsVerticalScrollIndicator={false}
      testID="unscheduled-task-list"
    />
  );
}
