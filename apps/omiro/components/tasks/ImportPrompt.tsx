import { Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';

interface ImportPromptProps {
  count: number | null;
  busy: boolean;
  onImport: () => void;
  onStartFresh: () => void;
}

// First run: bring Reminders along or begin empty. Importing moves them, so
// the line under the title says they leave Reminders.
export function ImportPrompt({ count, busy, onImport, onStartFresh }: ImportPromptProps) {
  const styles = useStyles((theme) => ({
    card: {
      backgroundColor: theme.colors.card,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.xl,
      gap: 12,
      padding: 20,
    },
    title: { ...theme.textVariants.title2, color: theme.colors.foreground },
    hint: { ...theme.textVariants.subhead, color: theme.colors.mutedForeground },
    actions: { gap: 8, paddingTop: 4 },
  }));
  return (
    <View style={styles.card} testID="tasks-import-prompt">
      <Text style={styles.title}>Import your reminders</Text>
      <Text style={styles.hint}>They move here and leave Reminders.</Text>
      <View style={styles.actions}>
        <Button
          disabled={busy}
          label={count === null ? 'Import' : `Import ${count}`}
          onPress={onImport}
          testID="tasks-import-confirm"
          variant="primary"
        />
        <Button
          disabled={busy}
          label="Start fresh"
          onPress={onStartFresh}
          testID="tasks-import-fresh"
          variant="ghost"
        />
      </View>
    </View>
  );
}
