import type { SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import { TextField } from '~/components/ui';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

interface InlineEnhanceTrayProps {
  instruction: string;
  onInstructionChange: (value: string) => void;
  onPresetSelect: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  // Only NoteScreen's inline flow actually waits on the request and needs
  // these. The composer's enhance-sheet route dismisses right away and shows
  // its own loading state on the composer instead (see EnhanceParticles),
  // so it just leaves both unset.
  isEnhancing?: boolean;
  error?: string | null;
}

type EnhanceSuggestion = (typeof t.enhance.suggestions)[number];
const suggestionIcons: Record<EnhanceSuggestion, SFSymbol> = {
  Fix: 'checkmark',
  Shorten: 'chevron.down',
  Expand: 'plus',
  Bullets: 'list.bullet',
};

export function InlineEnhanceTray({
  instruction,
  onInstructionChange,
  onPresetSelect,
  onCancel,
  onConfirm,
  isEnhancing = false,
  error = null,
}: InlineEnhanceTrayProps) {
  const { eventCoral, eventForeground, eventSky, eventSun, eventViolet } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    container: { gap: 12, marginVertical: 12 },
    actions: { flexDirection: 'row', gap: 10 },
    action: { flex: 1 },
    errorText: { color: theme.colors.destructive, lineHeight: 16 },
    suggestionRow: { flexDirection: 'row', gap: 8 },
    suggestion: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 20,
      flex: 1,
      gap: 6,
      height: 64,
      justifyContent: 'center',
    },
    suggestionLabel: { color: theme.colors.eventForeground, fontSize: 14, fontWeight: '800' },
    input: {
      backgroundColor: theme.colors.background,
      borderCurve: 'continuous',
      borderRadius: 24,
      color: theme.colors.foreground,
      fontSize: 16,
      minHeight: 48,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
  }));
  const tints: Record<EnhanceSuggestion, string> = {
    Fix: eventViolet,
    Shorten: eventCoral,
    Expand: eventSky,
    Bullets: eventSun,
  };

  return (
    <View style={styles.container}>
      <View style={styles.suggestionRow}>
        {t.enhance.suggestions.map((suggestion) => (
          <Pressable
            accessibilityLabel={suggestion}
            accessibilityRole="button"
            disabled={isEnhancing}
            key={suggestion}
            onPress={() => onPresetSelect(suggestion)}
            style={[styles.suggestion, { backgroundColor: tints[suggestion] }]}
          >
            <AppIcon name={suggestionIcons[suggestion]} size={22} tintColor={eventForeground} />
            <Text style={styles.suggestionLabel}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>

      <TextField
        value={instruction}
        onChangeText={onInstructionChange}
        placeholder={t.enhance.instructionPlaceholder}
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={onConfirm}
        editable={!isEnhancing}
      />

      <View style={styles.actions}>
        <Button
          label={t.enhance.cancel}
          onPress={onCancel}
          size="lg"
          style={styles.action}
          variant="secondary"
        />
        <Button
          label={t.enhance.confirm}
          loading={isEnhancing}
          onPress={onConfirm}
          size="lg"
          style={styles.action}
          variant="primary"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}
