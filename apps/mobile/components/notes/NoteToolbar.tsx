import type { SFSymbol } from 'expo-symbols';
import React from 'react';
import { InputAccessoryView, Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { makeStyles, spacing } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import { BlurSurface } from '~/components/ui/BlurSurface';
import AppIcon from '~/components/ui/icon';
import type { FormatAction } from '~/hooks/use-note-toolbar';

export const NOTE_TOOLBAR_ID = 'note-editor-toolbar';

interface NoteToolbarProps {
  onAction: (action: FormatAction) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface ToolbarButtonProps {
  icon: SFSymbol;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}

function ToolbarButton({ icon, onPress, disabled = false, label }: ToolbarButtonProps) {
  const themeColors = useThemeColors();
  const styles = useToolbarStyles();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonHost,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null,
      ]}
    >
      <AppIcon
        color={disabled ? themeColors['text-tertiary'] : themeColors.foreground}
        name={icon}
        size={17}
      />
    </Pressable>
  );
}

function ToolbarDivider() {
  const styles = useToolbarStyles();
  return <View style={styles.divider} />;
}

function ToolbarButtons({ onAction, onUndo, onRedo, canUndo, canRedo }: NoteToolbarProps) {
  const styles = useToolbarStyles();
  return (
    <>
      <View style={styles.group}>
        <ToolbarButton icon="bold" label="Bold" onPress={() => onAction('bold')} />
        <ToolbarButton icon="italic" label="Italic" onPress={() => onAction('italic')} />
        <ToolbarButton
          icon="strikethrough"
          label="Strikethrough"
          onPress={() => onAction('strikethrough')}
        />
        <ToolbarButton icon="curlybraces" label="Inline code" onPress={() => onAction('code')} />
      </View>

      <ToolbarDivider />

      <View style={styles.group}>
        <ToolbarButton icon="checklist" label="Checklist" onPress={() => onAction('checklist')} />
        <ToolbarButton icon="list.bullet" label="Bullet list" onPress={() => onAction('bullet')} />
        <ToolbarButton icon="increase.indent" label="Indent" onPress={() => onAction('indent')} />
        <ToolbarButton icon="decrease.indent" label="Outdent" onPress={() => onAction('outdent')} />
        <ToolbarButton
          icon="textformat.size.larger"
          label="Heading"
          onPress={() => onAction('heading')}
        />
      </View>

      <ToolbarDivider />

      <View style={styles.group}>
        <ToolbarButton
          icon="arrow.uturn.backward"
          label="Undo"
          onPress={onUndo}
          disabled={!canUndo}
        />
        <ToolbarButton
          icon="arrow.uturn.forward"
          label="Redo"
          onPress={onRedo}
          disabled={!canRedo}
        />
      </View>

      <ToolbarDivider />

      <ToolbarButton
        icon="keyboard.chevron.compact.down"
        label="Dismiss keyboard"
        onPress={() => Keyboard.dismiss()}
      />
    </>
  );
}

export function NoteToolbar(props: NoteToolbarProps) {
  const styles = useToolbarStyles();
  return (
    <InputAccessoryView nativeID={NOTE_TOOLBAR_ID} backgroundColor="transparent">
      <BlurSurface tint="chrome" style={styles.container}>
        <ToolbarButtons {...props} />
      </BlurSurface>
    </InputAccessoryView>
  );
}

const useToolbarStyles = makeStyles((theme) => ({
  container: {
    alignItems: 'center',
    borderTopColor: theme.colors['border-subtle'],
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  group: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[1],
  },
  buttonHost: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  divider: {
    backgroundColor: theme.colors['border-subtle'],
    height: 20,
    marginHorizontal: spacing[1],
    width: 1,
  },
}));
