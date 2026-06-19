import { Host, TextInput, type ObservableState, type TextInputRef } from '@expo/ui';
import { radii, spacing } from '@hominem/ui/tokens';
import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { makeStyles, shadowsNative } from '~/components/theme';
import { createLayoutTransition } from '~/components/theme/animations';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

const INPUT_MIN_HEIGHT = 28;
const INPUT_MAX_HEIGHT = 128;

interface WorkspaceComposerShellProps {
  accessory?: React.ReactNode;
  inlinePanel?: React.ReactNode;
  leadingAction: React.ReactNode;
  actions: React.ReactNode;
  messageState: ObservableState<string>;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder: string;
  inputRef: React.RefObject<TextInputRef | null>;
  autoFocus?: boolean;
  isExpanded: boolean;
  testID?: string;
}

export function WorkspaceComposerShell({
  accessory,
  inlinePanel,
  leadingAction,
  actions,
  messageState,
  onChangeText,
  onFocus,
  onBlur,
  placeholder,
  inputRef,
  autoFocus = false,
  isExpanded,
  testID,
}: WorkspaceComposerShellProps) {
  const styles = useStyles();
  const prefersReducedMotion = useReducedMotion();

  return (
    <Animated.View
      layout={createLayoutTransition(prefersReducedMotion)}
      style={[styles.surface, isExpanded ? styles.surfaceExpanded : styles.surfaceCompact]}
      testID={testID}
    >
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      <Host matchContents style={styles.host}>
        <TextInput
          ref={inputRef}
          autoFocus={autoFocus}
          multiline
          value={messageState}
          onBlur={onBlur}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor="#8B95A7"
          selectionColor="#6F73FF"
          cursorColor="#6F73FF"
          style={styles.input}
          textStyle={styles.inputText}
        />
      </Host>
      {inlinePanel ? <View style={styles.inlinePanel}>{inlinePanel}</View> : null}
      <View style={styles.bottomRail}>
        <View style={styles.leadingActionSlot}>{leadingAction}</View>
        <View style={styles.actionsSlot}>{actions}</View>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((theme) => ({
  surface: {
    ...shadowsNative.low,
    backgroundColor: theme.colors['bg-elevated'],
    borderColor: theme.colors['border-default'],
    borderRadius: radii.xl,
    borderWidth: 1,
    elevation: 6,
    gap: spacing[2],
    overflow: 'hidden',
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    width: '100%',
  },
  surfaceCompact: {
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  surfaceExpanded: {
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
  },
  accessory: {
    gap: spacing[2],
    width: '100%',
  },
  host: {
    width: '100%',
  },
  input: {
    maxHeight: INPUT_MAX_HEIGHT,
    minHeight: INPUT_MIN_HEIGHT,
    width: '100%',
  },
  inputText: {
    color: theme.colors.foreground,
    fontSize: 16,
    letterSpacing: 0,
    lineHeight: 22,
  },
  inlinePanel: {
    width: '100%',
  },
  bottomRail: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
    width: '100%',
  },
  leadingActionSlot: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionsSlot: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 32,
  },
}));
