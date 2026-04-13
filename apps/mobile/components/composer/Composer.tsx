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
import React, { useCallback, useState } from 'react';
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
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { theme } from '~/components/theme';

import { CameraModal } from '../media/camera-modal';
import { VoiceSessionModal } from '../media/voice-session-modal';
import { useComposerContext } from './ComposerContext';
import {
  deriveComposerPresentation,
  type ComposerAttachment,
} from './composerState';
import { useComposerSubmission } from './useComposerSubmission';
import { useComposerMediaActions } from './useComposerMediaActions';

// ─── Layout constants (all derived from design tokens) ───────────────────────

/** Maximum card width so the composer doesn't span full-width on large devices. */
const MAX_WIDTH = 500;

/**
 * Input height bounds.
 * Min = spacing[4] × 2 = 32 (one comfortable line)
 * Max = spacing[7]  × 6 = 288 ≈ 300 (six visual rows)
 */
const INPUT_MIN_H = spacing[4] * 2;   // 32
const INPUT_MAX_H = spacing[6] * 9;   // 288

/**
 * Send button = spacing[4] × 2 = 32 × 32 — sits on the 8-pt grid.
 * Icon inside = spacing[3] = 12 (≈ 37 % of button — standard for filled circles).
 */
const SEND_BTN_SIZE = spacing[4] * 2;  // 32
const SEND_ICON_SIZE = spacing[3];     // 12

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
        tintColor={
          disabled
            ? theme.colors['text-tertiary']
            : theme.colors['bg-base']
        }
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
}: {
  sf: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={spacing[2]}
      style={({ pressed }) => [
        styles.secondaryBtn,
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
                <Image
                  source={{ uri: a.localUri }}
                  style={styles.thumbImage}
                  contentFit="cover"
                />
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

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({
  canSubmit,
  isSending,
  presentation,
  onPrimaryAction,
  onSecondaryAction,
}: {
  canSubmit: boolean;
  isSending: boolean;
  presentation: ReturnType<typeof deriveComposerPresentation>;
  onPrimaryAction: () => void;
  onSecondaryAction: (() => void) | null;
}) {
  const primarySf =
    presentation.primaryActionLabel === 'Send'
      ? 'arrow.up'
      : presentation.primaryActionLabel === 'Append'
      ? 'text.badge.plus'
      : 'square.and.pencil';

  return (
    <View style={styles.toolbar}>
      {presentation.secondaryActionLabel && onSecondaryAction ? (
        <SecondaryButton
          sf="bubble.left.and.text.bubble.right"
          onPress={onSecondaryAction}
          accessibilityLabel={presentation.secondaryActionLabel}
        />
      ) : null}
      <SendButton
        sf={primarySf}
        onPress={onPrimaryAction}
        disabled={!canSubmit || isSending}
        accessibilityLabel={isSending ? 'Sending…' : presentation.primaryActionLabel}
      />
    </View>
  );
}

// ─── Composer ───────────────────────────────────────────────────────────

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
    mode,
    selectedNoteIds,
    setAttachments,
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
    minHeight: animatedH.value,
    maxHeight: animatedH.value,
  }));

  const shellStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.value + Math.max(insets.bottom, spacing[2]),
  }));

  if (presentation.isHidden) return null;

  return (
    <Animated.View
      entering={createNotesEnterLift(prefersReducedMotion)}
      exiting={createNotesExitLift(prefersReducedMotion)}
      style={[styles.shell, shellStyle]}
    >
      <Animated.View
        layout={createNotesLayoutTransition(prefersReducedMotion)}
        style={styles.card}
        testID="mobile-composer"
      >
        {/* Attachments above input */}
        <Animated.View layout={createNotesLayoutTransition(prefersReducedMotion)}>
          <ComposerAttachments
            attachments={attachments}
            errors={uploadState.errors}
            isUploading={uploadState.isUploading}
            onRemoveAttachment={handleRemoveAttachment}
          />
        </Animated.View>

        {/* Text input */}
        <Animated.View style={inputStyle}>
          <TextInput
            multiline
            value={message}
            onChangeText={setMessage}
            onContentSizeChange={(e) =>
              onContentSizeChange(e.nativeEvent.contentSize.height)
            }
            placeholder={presentation.placeholder}
            placeholderTextColor={theme.colors['text-tertiary']}
            cursorColor={theme.colors.accent}
            selectionColor={theme.colors.accent}
            style={styles.input}
            testID="mobile-composer-input"
            textAlignVertical="top"
            scrollEnabled={false}
          />
        </Animated.View>

        {/* Submit toolbar */}
        <Toolbar
          canSubmit={canSubmit}
          isSending={isChatSending}
          presentation={presentation}
          onPrimaryAction={handlePrimaryAction}
          onSecondaryAction={
            presentation.secondaryActionLabel ? handleSecondaryAction : null
          }
        />
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
    paddingHorizontal: spacing[4],   // 16 — matches screen-level padding on all other screens
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
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
    borderRadius: radiiNative.icon,
    borderCurve: 'continuous',
    paddingHorizontal: spacing[3],   // 12
    paddingTop: spacing[2],          // 8
    paddingBottom: spacing[2],       // 8
    gap: spacing[2],                 // 8
    overflow: 'hidden',
    ...shadowsNative.low,
  },

  // Input: text-md variant (16 / 24) — same scale as body copy across the app
  input: {
    color: theme.colors.foreground,
    fontSize: theme.textVariants['text-md'].fontSize,
    lineHeight: theme.textVariants['text-md'].lineHeight,
    letterSpacing: -0.1,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  // Toolbar: right-aligned, height derives from SEND_BTN_SIZE
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[2],                 // 8
    minHeight: SEND_BTN_SIZE,
  },

  // Send button: spacing[4]×2 circle, filled with foreground color
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

  // Secondary button: borderless icon, 36 × 36 touch target
  secondaryBtn: {
    width: spacing[5] + spacing[3],  // 24+12 = 36
    height: spacing[5] + spacing[3], // 36
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiiNative.md,
    borderCurve: 'continuous',
  },
  secondaryBtnPressed: {
    backgroundColor: theme.colors['bg-surface'],
  },
  secondaryBtnIcon: {
    width: spacing[3],               // 12
    height: spacing[3],              // 12
  },

  // Attachments
  attachments: {
    gap: spacing[2],
  },
  attachmentRow: {
    gap: spacing[2],
    paddingBottom: spacing[1],
  },

  // Thumbnail: spacing[4]×3 = 48 × 48, radiiNative.md = 8
  thumb: {
    width: spacing[4] * 3,          // 48
    height: spacing[4] * 3,         // 48
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
    top: spacing[1],                 // 4
    right: spacing[1],               // 4
    width: spacing[2] * 2,          // 16
    height: spacing[2] * 2,         // 16
    borderRadius: radiiNative.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBadgeIcon: {
    width: spacing[1] + 2,          // 6
    height: spacing[1] + 2,         // 6
  },
  thumbDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // Error text: small variant specs
  errorText: {
    fontSize: theme.textVariants.small.fontSize,
    lineHeight: theme.textVariants.small.lineHeight,
    color: theme.colors.destructive,
  },
});
