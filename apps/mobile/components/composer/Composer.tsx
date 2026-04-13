/**
 * Composer
 *
 * Design-system rules:
 *   Surface    → theme.colors['bg-elevated']   (floating element, one step above bg-base)
 *   Border     → theme.colors['border-default'] (18 % opacity — elevated surfaces need more definition)
 *   Shadow     → shadowsNative.low              (low = persistent toolbar; medium/high = modals)
 *   Radii      → radiiNative.*                  (no magic numbers — icon=20, md=8, full=9999)
 *   Spacing    → spacing[n]                     (4 | 8 | 12 | 16 | 24 | 32 …)
 *   Typography → theme.textVariants directly    (16 px / 24 lh matches text-md variant)
 *   Accent     → theme.colors.accent            (cursor, selection, active states)
 */

import { radiiNative, shadowsNative, spacing } from '@hominem/ui/tokens';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createNotesEnterLift,
  createNotesExitLift,
  createNotesLayoutTransition,
} from '~/components/notes/notes-surface-motion';
import { theme } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

import { CameraModal } from '../media/camera-modal';
import { VoiceSessionModal } from '../media/voice-session-modal';
import { useComposerContext } from './ComposerContext';
import { deriveComposerPresentation, type ComposerAttachment } from './composerState';
import { useComposerMediaActions } from './useComposerMediaActions';
import { useComposerSubmission } from './useComposerSubmission';

// ─── Layout constants (all derived from design tokens) ───────────────────────

/** Maximum card width so the composer doesn't span full-width on large devices. */
const MAX_WIDTH = 500;

/**
 * Input height bounds.
 * Min = spacing[4] × 2 = 32 (one comfortable line)
 * Max = spacing[7]  × 6 = 288 ≈ 300 (six visual rows)
 */
const INPUT_MIN_H = spacing[6] + spacing[4]; // 40
const INPUT_MAX_H = spacing[6] * 9; // 288

/**
 * Send button = spacing[4] × 2 = 32 × 32 — sits on the 8-pt grid.
 * Icon inside = spacing[3] = 12 (≈ 37 % of button — standard for filled circles).
 */
const SEND_BTN_SIZE = spacing[4] * 2; // 32
const SEND_ICON_SIZE = spacing[3]; // 12

// ─── SendButton ──────────────────────────────────────────────────────────────

function SendButton({
  sf,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  sf: string;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.sendBtn,
        disabled ? styles.sendBtnDisabled : null,
        pressed && !disabled ? styles.sendBtnPressed : null,
      ]}
    >
      <Image
        source={`sf:${sf}`}
        style={styles.sendBtnIcon}
        tintColor={disabled ? theme.colors['text-tertiary'] : theme.colors['bg-base']}
        contentFit="contain"
      />
    </Pressable>
  );
}

// ─── SecondaryButton ─────────────────────────────────────────────────────────

function SecondaryButton({
  sf,
  onPress,
  accessibilityLabel,
  disabled = false,
}: {
  sf: string;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={spacing[2]}
      style={({ pressed }) => [
        styles.secondaryBtn,
        disabled ? styles.secondaryBtnDisabled : null,
        pressed ? styles.secondaryBtnPressed : null,
      ]}
    >
      <Image
        source={`sf:${sf}`}
        style={styles.secondaryBtnIcon}
        tintColor={theme.colors['text-secondary']}
        contentFit="contain"
      />
    </Pressable>
  );
}

// ─── Attachment strip ─────────────────────────────────────────────────────────

function ComposerAttachments({
  attachments,
  errors,
  isUploading,
  onRemoveAttachment,
}: {
  attachments: ComposerAttachment[];
  errors: string[];
  isUploading: boolean;
  onRemoveAttachment: (id: string) => void;
}) {
  if (attachments.length === 0 && errors.length === 0 && !isUploading) {
    return null;
  }

  return (
    <View style={styles.attachments}>
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.attachmentRow}
        >
          {attachments.map((a) => (
            <Pressable
              key={a.id}
              style={styles.thumb}
              onPress={() => onRemoveAttachment(a.id)}
              accessibilityLabel={`Remove ${a.name}`}
              accessibilityRole="button"
            >
              {a.localUri && (
                <Image source={{ uri: a.localUri }} style={styles.thumbImage} contentFit="cover" />
              )}
              {/* Remove badge */}
              <View style={styles.thumbBadge} pointerEvents="none">
                <Image
                  source="sf:xmark"
                  style={styles.thumbBadgeIcon}
                  tintColor={theme.colors.white}
                  contentFit="contain"
                />
              </View>
              {isUploading && <View style={styles.thumbDim} />}
            </Pressable>
          ))}
        </ScrollView>
      )}

      {errors.length > 0 && (
        <Animated.Text style={styles.errorText}>{errors.join(' · ')}</Animated.Text>
      )}
    </View>
  );
}

function ComposerSelectionSummary({ selectedNoteIds }: { selectedNoteIds: string[] }) {
  if (selectedNoteIds.length === 0) {
    return null;
  }

  return (
    <View style={styles.selectionRow}>
      <View style={styles.selectionChip}>
        <Image
          source="sf:bubble.left.and.text.bubble.right"
          style={styles.selectionChipIcon}
          tintColor={theme.colors['text-secondary']}
          contentFit="contain"
        />
        <Animated.Text style={styles.selectionChipText}>
          {selectedNoteIds.length} {selectedNoteIds.length === 1 ? 'note' : 'notes'} linked
        </Animated.Text>
      </View>
    </View>
  );
}

function AccessoryAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.accessoryAction,
        disabled ? styles.accessoryActionDisabled : null,
        pressed && !disabled ? styles.accessoryActionPressed : null,
      ]}
    >
      <Animated.Text style={styles.accessoryActionText}>{label}</Animated.Text>
    </Pressable>
  );
}

export const Composer = () => {
  const insets = useSafeAreaInsets();
  const animatedH = useSharedValue(INPUT_MIN_H);
  const keyboard = useAnimatedKeyboard();
  const prefersReducedMotion = useReducedMotion();

  const {
    target,
    attachments,
    clearDraft,
    isRecording,
    message,
    selectedNoteIds,
    setAttachments,
    setComposerClearance,
    setIsRecording,
    setMessage,
    setMode,
  } = useComposerContext();

  const { handleCameraCapture, handleVoiceTranscript, pickAttachment, uploadState } =
    useComposerMediaActions({
      attachments,
      setAttachments,
      message,
      setMessage,
      setIsRecording,
      setMode,
    });

  const {
    canSubmit,
    handlePrimaryAction,
    handleRemoveAttachment,
    handleSecondaryAction,
    isChatSending,
  } = useComposerSubmission({
    target,
    attachments,
    message,
    selectedNoteIds,
    isUploading: uploadState.isUploading,
    setAttachments,
    clearDraft,
  });

  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const presentation = deriveComposerPresentation(
    target,
    message.trim().length > 0 || attachments.length > 0,
    isRecording,
  );
  const primarySf =
    presentation.primaryActionLabel === 'Send'
      ? 'arrow.up'
      : presentation.primaryActionLabel === 'Append'
        ? 'text.badge.plus'
        : 'square.and.pencil';

  const onContentSizeChange = useCallback(
    (h: number) => {
      const clamped = Math.min(Math.max(h, INPUT_MIN_H), INPUT_MAX_H);
      animatedH.value = withSpring(clamped, {
        damping: 20,
        stiffness: 220,
        mass: 0.7,
        overshootClamping: false,
      });
    },
    [animatedH],
  );

  const inputStyle = useAnimatedStyle(() => ({
    flex: 1,
    minHeight: animatedH.value,
    maxHeight: animatedH.value,
  }));

  const shellStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.value + Math.max(insets.bottom, spacing[2]),
  }));

  useEffect(() => {
    if (presentation.isHidden) {
      setComposerClearance(0);
    }
  }, [presentation.isHidden, setComposerClearance]);

  useEffect(() => () => setComposerClearance(0), [setComposerClearance]);

  if (presentation.isHidden) return null;

  return (
    <Animated.View
      entering={createNotesEnterLift(prefersReducedMotion)}
      exiting={createNotesExitLift(prefersReducedMotion)}
      style={[styles.shell, shellStyle]}
    >
      <Animated.View
        layout={createNotesLayoutTransition(prefersReducedMotion)}
        onLayout={(event) => {
          setComposerClearance(
            event.nativeEvent.layout.height + Math.max(insets.bottom, spacing[2]),
          );
        }}
        style={styles.card}
        testID="mobile-composer"
      >
        <Animated.View layout={createNotesLayoutTransition(prefersReducedMotion)}>
          <ComposerAttachments
            attachments={attachments}
            errors={uploadState.errors}
            isUploading={uploadState.isUploading}
            onRemoveAttachment={handleRemoveAttachment}
          />
        </Animated.View>
        <ComposerSelectionSummary selectedNoteIds={selectedNoteIds} />
        <Animated.View style={[styles.inputSurface, inputStyle]}>
          <View style={styles.inputWrap}>
            <TextInput
              multiline
              value={message}
              onChangeText={setMessage}
              onContentSizeChange={(e) => onContentSizeChange(e.nativeEvent.contentSize.height)}
              placeholder={presentation.placeholder}
              placeholderTextColor={theme.colors['text-tertiary']}
              cursorColor={theme.colors.accent}
              selectionColor={theme.colors.accent}
              style={styles.input}
              testID="mobile-composer-input"
              textAlignVertical="top"
              scrollEnabled={false}
            />
          </View>
        </Animated.View>
        <View style={styles.accessoryRow}>
          <View style={styles.accessoryLeft}>
            {presentation.showsAttachmentButton ? (
              <>
                <SecondaryButton
                  sf="photo"
                  onPress={() => {
                    void pickAttachment();
                  }}
                  accessibilityLabel="Choose a photo"
                  disabled={isChatSending}
                />
                <SecondaryButton
                  sf="camera"
                  onPress={() => setIsCameraOpen(true)}
                  accessibilityLabel="Take a photo"
                  disabled={isChatSending}
                />
              </>
            ) : null}
            {presentation.showsVoiceButton ? (
              <SecondaryButton
                sf="waveform"
                onPress={() => setIsVoiceOpen(true)}
                accessibilityLabel="Record a voice message"
                disabled={isChatSending}
              />
            ) : null}
            {presentation.secondaryActionLabel ? (
              <AccessoryAction
                label={presentation.secondaryActionLabel}
                onPress={handleSecondaryAction}
                disabled={isChatSending}
              />
            ) : null}
          </View>
          <SendButton
            sf={primarySf}
            onPress={handlePrimaryAction}
            disabled={!canSubmit || isChatSending}
            accessibilityLabel={isChatSending ? 'Sending…' : presentation.primaryActionLabel}
          />
        </View>
      </Animated.View>

      <CameraModal
        visible={isCameraOpen}
        onCapture={(photo) => {
          void handleCameraCapture(photo).finally(() => setIsCameraOpen(false));
        }}
        onClose={() => setIsCameraOpen(false)}
      />
      <VoiceSessionModal
        onAudioTranscribed={(transcript) => {
          handleVoiceTranscript(transcript);
          setIsVoiceOpen(false);
        }}
        onClose={() => {
          setIsRecording(false);
          setMode('text');
          setIsVoiceOpen(false);
        }}
        visible={isVoiceOpen}
      />
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Shell: positions the card above the keyboard / home indicator
  shell: {
    left: 0,
    right: 0,
    paddingHorizontal: spacing[4],
    position: 'absolute',
    alignItems: 'center',
  },

  // Card: the floating input surface
  // bg-elevated = rgba(33,34,37,1) in dark — visible contrast over bg-base / background
  // border-default = 18% opacity — elevated surfaces need more definition than border-subtle
  // shadowsNative.low = appropriate weight for a persistent bottom toolbar (not a modal)
  // radiiNative.icon = 20 — the largest non-pill radius defined in the token set
  card: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    backgroundColor: theme.colors['bg-elevated'],
    // borderWidth: 1,
    // borderColor: theme.colors['border-default'],
    borderRadius: radiiNative.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing[1],
    paddingTop: spacing[1],
    paddingBottom: spacing[3],
    gap: spacing[2],
    overflow: 'hidden',
    ...shadowsNative.low,
  },

  inputSurface: {
    minHeight: INPUT_MIN_H + spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    color: theme.colors.foreground,
    fontSize: theme.textVariants['text-md'].fontSize,
    lineHeight: theme.textVariants['text-md'].lineHeight,
    letterSpacing: -0.1,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  accessoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'space-between',
  },
  accessoryLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[1],
    minHeight: SEND_BTN_SIZE,
    flexShrink: 1,
  },
  accessoryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: radiiNative.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: SEND_BTN_SIZE,
    paddingHorizontal: spacing[3],
  },
  accessoryActionDisabled: {
    opacity: 0.4,
  },
  accessoryActionPressed: {
    opacity: 0.75,
  },
  accessoryActionText: {
    color: theme.colors['text-secondary'],
    fontSize: theme.textVariants.small.fontSize,
    lineHeight: theme.textVariants.small.lineHeight,
  },

  sendBtn: {
    width: SEND_BTN_SIZE,
    height: SEND_BTN_SIZE,
    borderRadius: radiiNative.full,
    backgroundColor: theme.colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: theme.colors['bg-base'],
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
  },
  sendBtnPressed: {
    opacity: 0.7,
  },
  sendBtnIcon: {
    width: SEND_ICON_SIZE,
    height: SEND_ICON_SIZE,
  },
  secondaryBtn: {
    width: spacing[5] + spacing[2],
    height: spacing[5] + spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiiNative.md,
    borderCurve: 'continuous',
  },
  secondaryBtnDisabled: {
    opacity: 0.4,
  },
  secondaryBtnPressed: {
    backgroundColor: theme.colors['bg-surface'],
  },
  secondaryBtnIcon: {
    width: spacing[4],
    height: spacing[4],
  },
  attachments: {
    gap: spacing[2],
  },
  attachmentRow: {
    gap: spacing[2],
    paddingBottom: spacing[1],
  },
  thumb: {
    width: spacing[4] * 3,
    height: spacing[4] * 3,
    borderRadius: radiiNative.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: theme.colors['bg-surface'],
  },
  thumbImage: {
    width: spacing[4] * 3,
    height: spacing[4] * 3,
  },
  thumbBadge: {
    position: 'absolute',
    top: spacing[1],
    right: spacing[1],
    width: spacing[2] * 2,
    height: spacing[2] * 2,
    borderRadius: radiiNative.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBadgeIcon: {
    width: spacing[1] + 2,
    height: spacing[1] + 2,
  },
  thumbDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  selectionRow: {
    flexDirection: 'row',
  },
  selectionChip: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: radiiNative.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  selectionChipIcon: {
    height: spacing[3],
    width: spacing[3],
  },
  selectionChipText: {
    color: theme.colors['text-secondary'],
    fontSize: theme.textVariants.small.fontSize,
    lineHeight: theme.textVariants.small.lineHeight,
  },
  errorText: {
    fontSize: theme.textVariants.small.fontSize,
    lineHeight: theme.textVariants.small.lineHeight,
    color: theme.colors.destructive,
  },
});
