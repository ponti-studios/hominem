import { useState } from 'react';
import { View } from 'react-native';

import { ComposerSendButton } from '~/components/composer/ComposerSendButton';
import { fontFamilies, useAppTheme, useStyles, withAlpha } from '~/components/theme';
import { TextField } from '~/components/ui';
import { useTaskCreate } from '~/services/tasks/use-task-create';

// The Tasks tab's composer: the same dark bar as Chat and Notes, but it only
// makes tasks. A new task has no day, so it lands in the inbox to be placed.
export function TaskComposer() {
  const { barForeground } = useAppTheme().colors;
  const [title, setTitle] = useState('');
  const create = useTaskCreate();
  const styles = useStyles((theme) => ({
    surface: {
      alignItems: 'center',
      backgroundColor: theme.colors.bar,
      borderCurve: 'continuous',
      borderRadius: 28,
      boxShadow: theme.shadows.bar,
      flexDirection: 'row',
      gap: 8,
      minHeight: 56,
      paddingLeft: 20,
      paddingRight: 8,
      paddingVertical: 8,
    },
    field: { flex: 1 },
  }));

  const canSubmit = title.trim().length > 0;
  const submit = () => {
    if (!canSubmit) {
      return;
    }
    create.mutate({ title: title.trim() });
    setTitle('');
  };

  return (
    <View style={styles.surface} testID="task-composer">
      <View style={styles.field}>
        <TextField
          cursorColor={barForeground}
          focusBorder={false}
          onChangeText={setTitle}
          onSubmitEditing={submit}
          placeholder="Add a task"
          placeholderTextColor={withAlpha(barForeground, 0.55)}
          returnKeyType="done"
          selectionColor={withAlpha(barForeground, 0.35)}
          style={{
            borderRadius: 0,
            borderWidth: 0,
            color: barForeground,
            fontFamily: fontFamilies.sans,
            fontSize: 17,
            fontWeight: '500',
            minHeight: 0,
            paddingHorizontal: 0,
            paddingVertical: 2,
          }}
          submitBehavior="submit"
          testID="task-composer-input"
          value={title}
        />
      </View>
      <ComposerSendButton
        accessibilityLabel="Add task"
        disabled={!canSubmit}
        icon="arrow.up"
        onPress={submit}
        size={40}
        testID="task-composer-submit"
      />
    </View>
  );
}
