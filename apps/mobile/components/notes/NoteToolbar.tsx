import type { SFSymbol } from 'expo-symbols';
import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { FormatCommand } from '~/components/notes/note-formatting';
import { makeStyles, useThemeColors } from '~/components/theme';
import { BlurSurface } from '~/components/ui/BlurSurface';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

export const NOTE_TOOLBAR_ID = 'note-editor-toolbar';

interface NoteToolbarProps {
  onAction: (action: FormatCommand) => void;
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
        tintColor={disabled ? themeColors['text-tertiary'] : themeColors.foreground}
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        <View style={styles.group}>
          <ToolbarButton
            icon="bold"
            label={t.notes.toolbar.bold}
            onPress={() => onAction('bold')}
          />
          <ToolbarButton
            icon="italic"
            label={t.notes.toolbar.italic}
            onPress={() => onAction('italic')}
          />
          <ToolbarButton
            icon="strikethrough"
            label={t.notes.toolbar.strikethrough}
            onPress={() => onAction('strikethrough')}
          />
          <ToolbarButton
            icon="curlybraces"
            label={t.notes.toolbar.inlineCode}
            onPress={() => onAction('code')}
          />
        </View>

        <ToolbarDivider />

        <View style={styles.group}>
          <ToolbarButton
            icon="textformat.size.larger"
            label={t.notes.toolbar.heading}
            onPress={() => onAction('heading')}
          />
          <ToolbarButton
            icon="text.quote"
            label={t.notes.toolbar.blockquote}
            onPress={() => onAction('blockquote')}
          />
        </View>

        <ToolbarDivider />

        <View style={styles.group}>
          <ToolbarButton
            icon="checklist"
            label={t.notes.toolbar.checklist}
            onPress={() => onAction('checklist')}
          />
          <ToolbarButton
            icon="list.bullet"
            label={t.notes.toolbar.bulletList}
            onPress={() => onAction('bullet')}
          />
          <ToolbarButton
            icon="list.number"
            label={t.notes.toolbar.numberedList}
            onPress={() => onAction('numbered-list')}
          />
        </View>

        <ToolbarDivider />

        <View style={styles.group}>
          <ToolbarButton
            icon="increase.indent"
            label={t.notes.toolbar.indent}
            onPress={() => onAction('indent')}
          />
          <ToolbarButton
            icon="decrease.indent"
            label={t.notes.toolbar.outdent}
            onPress={() => onAction('outdent')}
          />
        </View>
      </ScrollView>

      <ToolbarDivider />

      <View style={styles.group}>
        <ToolbarButton
          icon="arrow.uturn.backward"
          label={t.notes.toolbar.undo}
          onPress={onUndo}
          disabled={!canUndo}
        />
        <ToolbarButton
          icon="arrow.uturn.forward"
          label={t.notes.toolbar.redo}
          onPress={onRedo}
          disabled={!canRedo}
        />
      </View>

      <ToolbarDivider />

      <ToolbarButton
        icon="keyboard.chevron.compact.down"
        label={t.notes.toolbar.dismissKeyboard}
        onPress={Keyboard.dismiss}
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
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  group: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
    marginHorizontal: theme.spacing.sm,
    width: 1,
  },
}));
